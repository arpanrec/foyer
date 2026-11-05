import dns from "node:dns";
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from "node:http";
import net from "node:net";
import type { Readable } from "node:stream";
import { createUnzip, constants as zlibConstants } from "node:zlib";

import { http, https, type FollowOptions } from "follow-redirects";

import cache from "@/utils/cache";
import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import { addCookieToJar, setCookieHeader } from "@/utils/proxy/cookie-jar";
import { foyerUserAgent } from "@/utils/proxy/user-agent";
import { isPublicAddress } from "@/utils/public-address";

const logger = createLogger("httpProxy");

// Request options for `httpProxy`: the Node request options plus the keys the proxy layer reads
export type HttpProxyParams = Omit<RequestOptions, "headers"> &
    FollowOptions<RequestOptions> & {
        headers?: Record<string, string | number | string[] | undefined> | undefined;
        body?: string | Buffer | undefined;
        cookieHeader?: string | undefined;
        // false keeps the request out of the shared cookie jar: it sends none of its cookies and stores none
        useCookieJar?: boolean | undefined;
        // true refuses to connect to any address that is not on the public internet, redirects included
        publicOnly?: boolean | undefined;
        [key: string]: unknown;
    };

type Requestor = typeof http | typeof https;

function addCookieHandler(url: string | URL, params: HttpProxyParams) {
    setCookieHeader(url, params);

    // handle cookies during redirects
    params.beforeRedirect = (options: RequestOptions & { href?: string | undefined }, responseInfo) => {
        const href = options.href ?? "";
        addCookieToJar(href, responseInfo.headers);
        setCookieHeader(href, options, { overwrite: true });
    };
}

// [status, content type, body, response headers]
type RawResponse = [number, string | undefined, Buffer, IncomingHttpHeaders];

// [status, content type, body, response headers, request params]. A failed call has no params and null headers.
export type HttpProxyResponse = [
    status: number,
    contentType: string | undefined,
    data: unknown,
    headers: IncomingHttpHeaders | null,
    params?: HttpProxyParams,
];

function handleRequest(requestor: Requestor, url: string | URL, params: HttpProxyParams) {
    return new Promise<RawResponse>((resolve, reject) => {
        const useCookieJar = params.useCookieJar !== false;
        if (useCookieJar) addCookieHandler(url, params);
        if (params?.body) {
            params.headers = params.headers ?? {};
            params.headers["content-length"] = Buffer.byteLength(params.body);
        }

        const request = requestor.request(url, params, (response: IncomingMessage) => {
            const data: Buffer[] = [];
            const contentEncoding = response.headers["content-encoding"]?.trim().toLowerCase();

            // a connection that dies while the body is still arriving would otherwise leave the promise pending
            response.on("error", (error: Error) => {
                reject([500, error]);
            });

            let responseContent: Readable = response;
            if (contentEncoding === "gzip" || contentEncoding === "deflate") {
                // https://github.com/request/request/blob/3c0cddc7c8eb60b470e9519da85896ed7ee0081e/request.js#L1018-L1025
                // Be more lenient with decoding compressed responses, in case of invalid gzip responses that are still accepted
                // by common browsers.
                const unzip = createUnzip({
                    flush: zlibConstants.Z_SYNC_FLUSH,
                    finishFlush: zlibConstants.Z_SYNC_FLUSH,
                });

                responseContent = unzip;

                // zlib errors
                unzip.on("error", (e: Error) => {
                    logger.error("Error decompressing the response from %s: %s", new URL(url).host, e.message);
                    logger.debug("Error decompressing the response from %s: %s", url, e.message);
                    responseContent = response; // fallback
                });
                response.pipe(unzip);
            }

            responseContent.on("data", (chunk: Buffer) => {
                data.push(chunk);
            });

            responseContent.on("end", () => {
                if (useCookieJar) addCookieToJar(url, response.headers);
                resolve([
                    response.statusCode ?? 0,
                    response.headers["content-type"],
                    Buffer.concat(data),
                    response.headers,
                ]);
            });
        });

        request.on("error", (error: Error) => {
            reject([500, error]);
        });

        // `timeout` is the Node socket idle timeout in milliseconds. Node only reports it, so it ends the request here.
        if (params?.timeout) {
            request.on("timeout", () => {
                request.destroy(new Error(`No data for ${params.timeout} ms`));
            });
        }

        if (params?.body) {
            request.write(params.body);
        }

        request.end();
    });
}

export function httpsRequest(url: string | URL, params: HttpProxyParams) {
    return handleRequest(https, url, params);
}

export function httpRequest(url: string | URL, params: HttpProxyParams) {
    return handleRequest(http, url, params);
}

export async function cachedRequest(url: string, duration = 5, ua?: string): Promise<unknown> {
    return cache.getOrFetch<unknown>(
        url,
        async () => {
            const options = {
                headers: {
                    "User-Agent": ua ?? foyerUserAgent(url),
                    Accept: "application/json",
                },
            };
            let [, , data] = await httpProxy(url, options);
            if (Buffer.isBuffer(data)) {
                const text = data.toString();
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    logger.debug("Error parsing cachedRequest data for %s: %s %s", url, text, e);
                    data = text;
                }
            }
            return data;
        },
        { type: "response", ttlMs: duration * 1000 * 60 }
    );
}

// Custom DNS lookup that falls back to Node.js c-ares resolver (dns.resolve)
// when system getaddrinfo (dns.lookup) fails with ENOTFOUND/EAI_NONAME.
// Fixes DNS resolution issues with Alpine/musl libc in k8s
const FALLBACK_CODES = new Set(["ENOTFOUND", "EAI_NONAME"]);

type LookupAddresses = string | string[] | dns.LookupAddress[];

// The lookup callback reports a failure with the error alone, which Node's own signature leaves out
type LookupCallback = (
    err: NodeJS.ErrnoException | null,
    address?: LookupAddresses,
    family?: number
) => void | undefined;

type ResolveFn = (hostname: string, callback: (err: NodeJS.ErrnoException | null, addresses: string[]) => void) => void;

function foyerDNSLookupFn() {
    const normalizeOptions = (options: dns.LookupOptions | number | undefined) => {
        if (typeof options === "number") {
            return { family: options, all: false, lookupOptions: { family: options } };
        }

        const normalized = options ?? {};
        return {
            family: normalized.family,
            all: Boolean(normalized.all),
            lookupOptions: normalized,
        };
    };

    function lookup(hostname: string, options: dns.LookupOptions | number | undefined, callback: LookupCallback): void;
    function lookup(hostname: string, callback: LookupCallback): void;
    function lookup(
        hostname: string,
        optionsOrCallback: dns.LookupOptions | number | undefined | LookupCallback,
        maybeCallback?: LookupCallback
    ) {
        // Handle case where options is the callback (2-argument form)
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
        const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
        if (!callback) return;

        const { family, all, lookupOptions } = normalizeOptions(options);
        const sendResponse = (addr: LookupAddresses, fam: number) => {
            if (all) {
                const addresses: dns.LookupAddress[] = Array.isArray(addr)
                    ? addr.map((a) => (typeof a === "string" ? { address: a, family: fam } : a))
                    : [{ address: addr, family: fam }];

                callback(null, addresses);
            } else {
                callback(null, addr, fam);
            }
        };

        // If hostname is already an IP address, return it directly
        const ipVersion = net.isIP(hostname);
        if (ipVersion) {
            sendResponse(hostname, ipVersion);
            return;
        }

        // Try dns.lookup first (preserves /etc/hosts behavior)
        dns.lookup(hostname, lookupOptions, (lookupErr, address, lookupFamily) => {
            if (!lookupErr) {
                sendResponse(address, lookupFamily);
                return;
            }

            // ENOTFOUND or EAI_NONAME will try fallback, otherwise return error here
            if (!FALLBACK_CODES.has(lookupErr.code ?? "")) {
                callback(lookupErr);
                return;
            }

            const finalize = (addresses: string[] | undefined, resolvedFamily: number) => {
                // Finalize the resolution and call the callback
                if (!addresses || addresses.length === 0) {
                    const err: NodeJS.ErrnoException = new Error(`No addresses found for hostname: ${hostname}`);
                    err.code = "ENOTFOUND";
                    callback(err);
                    return;
                }

                logger.debug("DNS fallback to c-ares resolver succeeded for %s", hostname);

                sendResponse(addresses, resolvedFamily);
            };

            const resolveOnce = (
                fn: ResolveFn,
                resolvedFamily: number,
                onFail: (resolveErr: NodeJS.ErrnoException) => void
            ) => {
                // attempt resolution with a specific resolver
                fn(hostname, (err, addresses) => {
                    if (!err) {
                        finalize(addresses, resolvedFamily);
                        return;
                    }
                    onFail(err);
                });
            };

            const handleFallbackFailure = (resolveErr: NodeJS.ErrnoException) => {
                // handle final fallback failure with full context
                logger.debug(
                    "DNS fallback failed for %s: lookup error=%s, resolve error=%s",
                    hostname,
                    lookupErr.code,
                    resolveErr?.code
                );
                callback(resolveErr || lookupErr);
            };

            // Fallback to c-ares (dns.resolve*). If family isn't specified, try v4 then v6.
            if (family === 6) {
                resolveOnce(dns.resolve6, 6, handleFallbackFailure);
                return;
            }

            if (family === 4) {
                resolveOnce(dns.resolve4, 4, handleFallbackFailure);
                return;
            }

            resolveOnce(dns.resolve4, 4, () => {
                resolveOnce(dns.resolve6, 6, handleFallbackFailure);
            });
        });
    }

    return lookup;
}

// Node calls the lookup with the shape of `net.LookupFunction`; the overloads above also accept the 2-argument form
const foyerLookup = foyerDNSLookupFn() as net.LookupFunction;
const agentCache = new Map<string, InstanceType<typeof https.Agent> | InstanceType<typeof http.Agent>>();

// The same lookup, but a name that resolves to a non-public address fails. The check sits in the connection, so a
// redirect, a DNS name that points at the local network and a literal IP are all covered.
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
    foyerLookup(hostname, options, (err, address, family) => {
        if (err) {
            callback(err, address as string, family as number);
            return;
        }
        const addresses = Array.isArray(address)
            ? address.map((a) => (typeof a === "string" ? a : a.address))
            : [address];
        if (!addresses.every((a) => isPublicAddress(a))) {
            const refused: NodeJS.ErrnoException = new Error(`${hostname} is not a public address`);
            refused.code = "EACCES";
            callback(refused, address as string, family as number);
            return;
        }
        callback(null, address as string, family as number);
    });
};

function getAgent(protocol: string, disableIpv6: boolean, publicOnly = false) {
    const cacheKey = `${protocol}:${disableIpv6 ? "ipv4" : "auto"}${publicOnly ? ":public" : ""}`;
    const cachedAgent = agentCache.get(cacheKey);
    if (cachedAgent) {
        return cachedAgent;
    }

    const agentOptions = {
        keepAlive: true,
        ...(disableIpv6 ? { family: 4, autoSelectFamily: false } : { autoSelectFamilyAttemptTimeout: 500 }),
        lookup: publicOnly ? publicLookup : foyerLookup,
    };

    const agent =
        protocol === "https:"
            ? new https.Agent({ ...agentOptions, rejectUnauthorized: false })
            : new http.Agent(agentOptions);

    agentCache.set(cacheKey, agent);
    return agent;
}

export async function httpProxy(url: string | URL, params: HttpProxyParams = {}): Promise<HttpProxyResponse> {
    const constructedUrl = new URL(url);
    const disableIpv6 = getEnv("PROXY_DISABLE_IPV6") === "true";
    let request: Promise<RawResponse>;
    if (constructedUrl.protocol === "https:") {
        request = httpsRequest(constructedUrl, {
            agent: getAgent(constructedUrl.protocol, disableIpv6, params.publicOnly === true),
            ...params,
        });
    } else {
        request = httpRequest(constructedUrl, {
            agent: getAgent(constructedUrl.protocol, disableIpv6, params.publicOnly === true),
            ...params,
        });
    }

    try {
        const [status, contentType, data, responseHeaders] = await request;
        return [status, contentType, data, responseHeaders, params];
    } catch (err) {
        const rawError = Array.isArray(err) ? err[1] : err;
        const message = errorMessage(rawError) ?? String(rawError);
        logger.error("Error calling %s: %s", constructedUrl.host, message);
        logger.debug("Error calling %s: %s", constructedUrl, message);
        logger.debug("%o", err);
        return [
            500,
            "application/json",
            {
                error: {
                    message: rawError?.message ?? "Unknown error",
                    url: sanitizeErrorURL(url),
                    rawError,
                },
            },
            null,
        ];
    }
}
