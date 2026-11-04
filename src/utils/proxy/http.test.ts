import { beforeEach, describe, expect, it, vi } from "vitest";

import { peek, seed } from "@/test-utils/cache";
import cache from "@/utils/cache";

type MockAgentOptions = {
    keepAlive?: boolean | undefined;
    family?: number | undefined;
    autoSelectFamily?: boolean | undefined;
    rejectUnauthorized?: boolean | undefined;
    lookup?: ((...args: unknown[]) => void) | undefined;
};

type MockRequestParams = {
    headers?: Record<string, string | number | string[] | undefined>;
    beforeRedirect?: (options: { href?: string }, responseInfo: { headers: Record<string, string[]> }) => void;
    agent?: { opts?: MockAgentOptions };
};

const { state, logger, dns, net, cookieJar } = vi.hoisted(() => ({
    state: {
        response: {
            statusCode: 200,
            headers: { "content-type": "application/json" } as Record<string, string>,
            body: Buffer.from(""),
        },
        error: null as Error | null,
        lastAgent: null as unknown,
        lastAgentOptions: null as MockAgentOptions | null,
        lastRequestParams: null as MockRequestParams | null,
        lastWrittenBody: null as unknown,
        lastRequest: null as {
            emit: (event: string, ...args: unknown[]) => boolean;
            destroy: ReturnType<typeof vi.fn>;
        } | null,
        responseError: null as Error | null,
    },
    logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    dns: {
        lookup: vi.fn(),
        resolve4: vi.fn(),
        resolve6: vi.fn(),
    },
    net: {
        isIP: vi.fn(),
    },
    cookieJar: {
        addCookieToJar: vi.fn(),
        setCookieHeader: vi.fn(),
    },
}));

vi.mock("node:dns", () => ({
    default: dns,
}));

vi.mock("node:net", () => ({
    default: net,
}));

vi.mock("follow-redirects", async () => {
    const { EventEmitter } = await import("node:events");
    const { Readable } = await import("node:stream");

    function Agent(this: { opts?: MockAgentOptions | undefined }, opts?: MockAgentOptions) {
        this.opts = opts;
    }

    function makeRequest() {
        return (_url: unknown, params: MockRequestParams, cb: (res: unknown) => void) => {
            const req = Object.assign(new EventEmitter(), {
                destroy: vi.fn(),
                write: vi.fn((chunk: unknown) => {
                    state.lastWrittenBody = chunk;
                }),
                end: vi.fn(() => {
                    state.lastAgent = params?.agent ?? null;
                    state.lastAgentOptions = params?.agent?.opts ?? null;
                    if (state.error) {
                        req.emit("error", state.error);
                        return;
                    }

                    const res = Object.assign(
                        new Readable({
                            read() {
                                if (state.responseError) {
                                    this.destroy(state.responseError);
                                    return;
                                }
                                this.push(state.response.body);
                                this.push(null);
                            },
                        }),
                        {
                            statusCode: state.response.statusCode,
                            headers: state.response.headers,
                        }
                    );
                    cb(res);
                }),
            });
            state.lastRequestParams = params;
            state.lastRequest = req;
            state.lastWrittenBody = null;
            return req;
        };
    }

    return {
        http: { request: makeRequest(), Agent },
        https: { request: makeRequest(), Agent },
    };
});

vi.mock("@/utils/proxy/cookie-jar", () => cookieJar);

// node:net is replaced above, so the real address check cannot load here
vi.mock("@/utils/public-address", () => ({
    isPublicAddress: (address: string) => !address.startsWith("10.") && !address.startsWith("127."),
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

describe("utils/proxy/http cachedRequest", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        state.error = null;
        state.response = {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: Buffer.from(""),
        };
        state.lastAgent = null;
        state.lastAgentOptions = null;
        state.lastRequestParams = null;
        state.lastWrittenBody = null;
        await cache.clear();
        vi.resetModules();
    });

    it("returns cached values without calling httpProxy", async () => {
        await seed("http://example.com", { ok: true }, "response");
        const httpMod = await import("@/utils/proxy/http");
        const spy = vi.spyOn(httpMod, "httpProxy");

        const data = await httpMod.cachedRequest("http://example.com");

        expect(data).toEqual({ ok: true });
        expect(spy).not.toHaveBeenCalled();
    });

    it("parses json buffer responses and caches the result", async () => {
        state.response.body = Buffer.from('{"a":1}');
        const httpMod = await import("@/utils/proxy/http");

        const data = await httpMod.cachedRequest("http://example.com/data", 1, "ua");

        expect(data).toEqual({ a: 1 });
        expect(await peek("http://example.com/data", "response")).toEqual({ a: 1 });
    });

    it("sends the Foyer User-Agent unless the caller gives one", async () => {
        state.response.body = Buffer.from("{}");
        const httpMod = await import("@/utils/proxy/http");

        await httpMod.cachedRequest("http://example.com/default");
        expect(state.lastRequestParams?.headers).toMatchObject({ "User-Agent": "foyer/dev" });

        await httpMod.cachedRequest("http://example.com/custom", 1, "ua");
        expect(state.lastRequestParams?.headers).toMatchObject({ "User-Agent": "ua" });
    });

    it("falls back to string when cachedRequest cannot parse json", async () => {
        state.response.body = Buffer.from("not-json");
        const httpMod = await import("@/utils/proxy/http");

        const data = await httpMod.cachedRequest("http://example.com/data", 1, "ua");

        expect(data).toBe("not-json");
        expect(logger.debug).toHaveBeenCalled();
    });
});

describe("utils/proxy/http foyerDNSLookupFn", () => {
    const getLookupFn = async () => {
        const httpMod = await import("@/utils/proxy/http");
        await httpMod.httpProxy("http://example.com");
        expect(state.lastAgentOptions?.lookup).toEqual(expect.any(Function));
        return state.lastAgentOptions!.lookup!;
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        state.error = null;
        state.lastAgentOptions = null;
        net.isIP.mockReturnValue(0);
        dns.lookup.mockImplementation((_hostname, _options, cb) => cb(null, "127.0.0.1", 4));
        dns.resolve4.mockImplementation((_hostname, cb) => cb(null, ["127.0.0.1"]));
        dns.resolve6.mockImplementation((_hostname, cb) => cb(null, ["::1"]));
        vi.resetModules();
    });

    it("short-circuits when hostname is already an IP (all=false)", async () => {
        const lookup = await getLookupFn();
        net.isIP.mockReturnValueOnce(4);
        const cb = vi.fn();

        lookup("1.2.3.4", cb);

        expect(dns.lookup).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(null, "1.2.3.4", 4);
    });

    it("short-circuits when hostname is already an IP (all=true)", async () => {
        const lookup = await getLookupFn();
        net.isIP.mockReturnValueOnce(6);
        const cb = vi.fn();

        lookup("::1", { all: true }, cb);

        expect(dns.lookup).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(null, [{ address: "::1", family: 6 }]);
    });

    it("does nothing when no callback is given", async () => {
        const lookup = await getLookupFn();
        dns.lookup.mockClear();

        expect(() =>
            (lookup as unknown as (hostname: string, options: object) => void)("example.com", {})
        ).not.toThrow();
        expect(dns.lookup).not.toHaveBeenCalled();
    });

    it("uses dns.lookup when it succeeds (2-argument form)", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(null, "10.0.0.1", 4));
        lookup("example.com", cb);

        expect(dns.lookup).toHaveBeenCalledWith("example.com", {}, expect.any(Function));
        expect(dns.resolve4).not.toHaveBeenCalled();
        expect(dns.resolve6).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(null, "10.0.0.1", 4);
    });

    it("does not fall back for non-ENOTFOUND/EAI_NONAME lookup errors", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const err = Object.assign(new Error("temporary"), { code: "EAI_AGAIN" });
        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(err));

        lookup("example.com", { all: true }, cb);

        expect(dns.resolve4).not.toHaveBeenCalled();
        expect(dns.resolve6).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(err);
    });

    it("falls back to resolve4 when lookup fails with ENOTFOUND and family=4", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const lookupErr = Object.assign(new Error("not found"), { code: "ENOTFOUND" });

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(lookupErr));
        dns.resolve4.mockImplementationOnce((_hostname, resolveCb) => resolveCb(null, ["1.1.1.1"]));

        lookup("example.com", { family: 4, all: true }, cb);

        expect(dns.resolve4).toHaveBeenCalledWith("example.com", expect.any(Function));
        expect(dns.resolve6).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(null, [{ address: "1.1.1.1", family: 4 }]);
        expect(logger.debug).toHaveBeenCalledWith("DNS fallback to c-ares resolver succeeded for %s", "example.com");
    });

    it("falls back to resolve6 when lookup fails with ENOTFOUND and family=6", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const lookupErr = Object.assign(new Error("not found"), { code: "ENOTFOUND" });

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(lookupErr));
        dns.resolve6.mockImplementationOnce((_hostname, resolveCb) => resolveCb(null, ["::1"]));

        lookup("example.com", 6, cb);

        expect(dns.lookup).toHaveBeenCalledWith("example.com", { family: 6 }, expect.any(Function));
        expect(dns.resolve4).not.toHaveBeenCalled();
        expect(dns.resolve6).toHaveBeenCalledWith("example.com", expect.any(Function));
        expect(cb).toHaveBeenCalledWith(null, ["::1"], 6);
    });

    it("tries resolve4 then resolve6 when lookup fails and no family is specified", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const lookupErr = Object.assign(new Error("not found"), { code: "ENOTFOUND" });

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(lookupErr));
        dns.resolve4.mockImplementationOnce((_hostname, resolveCb) =>
            resolveCb(Object.assign(new Error("v4 failed"), { code: "EAI_FAIL" }))
        );
        dns.resolve6.mockImplementationOnce((_hostname, resolveCb) => resolveCb(null, ["::1"]));

        lookup("example.com", { all: true }, cb);

        expect(dns.resolve4).toHaveBeenCalledWith("example.com", expect.any(Function));
        expect(dns.resolve6).toHaveBeenCalledWith("example.com", expect.any(Function));
        expect(cb).toHaveBeenCalledWith(null, [{ address: "::1", family: 6 }]);
    });

    it("returns ENOTFOUND when fallback resolver returns no addresses", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const lookupErr = Object.assign(new Error("not found"), { code: "ENOTFOUND" });

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(lookupErr));
        dns.resolve4.mockImplementationOnce((_hostname, resolveCb) => resolveCb(null, []));

        lookup("example.com", { family: 4, all: true }, cb);

        const err = cb.mock.calls[0]![0];
        expect(err).toBeInstanceOf(Error);
        expect(err.code).toBe("ENOTFOUND");
        expect(dns.resolve6).not.toHaveBeenCalled();
    });

    it("returns resolve error when fallback resolver fails", async () => {
        const lookup = await getLookupFn();
        const cb = vi.fn();
        const lookupErr = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
        const resolveErr = Object.assign(new Error("resolver down"), { code: "EAI_FAIL" });

        dns.lookup.mockImplementationOnce((_hostname, _options, lookupCb) => lookupCb(lookupErr));
        dns.resolve4.mockImplementationOnce((_hostname, resolveCb) => resolveCb(resolveErr));

        lookup("example.com", { family: 4, all: true }, cb);

        expect(cb).toHaveBeenCalledWith(resolveErr);
        expect(logger.debug).toHaveBeenCalledWith(
            "DNS fallback failed for %s: lookup error=%s, resolve error=%s",
            "example.com",
            "ENOTFOUND",
            "EAI_FAIL"
        );
    });
});

describe("utils/proxy/http httpProxy", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        state.error = null;
        state.response = {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: Buffer.from("ok"),
        };
        state.lastAgent = null;
        state.lastAgentOptions = null;
        state.lastRequestParams = null;
        state.lastWrittenBody = null;
        process.env["FOYER_PROXY_DISABLE_IPV6"] = "";
        vi.resetModules();
    });

    it("sets content-length and writes request bodies", async () => {
        const httpMod = await import("@/utils/proxy/http");
        const body = "abc";

        const [status] = await httpMod.httpProxy("http://example.com", { method: "POST", body, headers: {} });

        expect(status).toBe(200);
        expect(state.lastRequestParams?.headers?.["content-length"]).toBe(3);
        expect(state.lastWrittenBody).toBe(body);
    });

    it("installs a beforeRedirect hook and updates the cookie jar", async () => {
        const httpMod = await import("@/utils/proxy/http");
        await httpMod.httpProxy("http://example.com");

        expect(state.lastRequestParams?.beforeRedirect).toEqual(expect.any(Function));
        expect(cookieJar.setCookieHeader).toHaveBeenCalled();
        expect(cookieJar.addCookieToJar).toHaveBeenCalled();
    });

    it("updates cookies during redirects via beforeRedirect", async () => {
        const httpMod = await import("@/utils/proxy/http");
        await httpMod.httpProxy("http://example.com");

        state.lastRequestParams?.beforeRedirect?.(
            { href: "http://example.com/redirect" },
            { headers: { "set-cookie": ["a=b"] } }
        );

        expect(cookieJar.addCookieToJar).toHaveBeenCalledWith("http://example.com/redirect", { "set-cookie": ["a=b"] });
        expect(cookieJar.setCookieHeader).toHaveBeenCalledWith("http://example.com/redirect", expect.any(Object), {
            overwrite: true,
        });
    });

    it("supports gzip-compressed responses", async () => {
        const { gzipSync } = await import("node:zlib");
        state.response.headers["content-encoding"] = "gzip";
        state.response.body = gzipSync(Buffer.from("hello"));

        const httpMod = await import("@/utils/proxy/http");
        const [, , data] = await httpMod.httpProxy("http://example.com");

        expect(Buffer.from(data as Buffer).toString()).toBe("hello");
    });

    it("logs when gzip decoding emits an error", async () => {
        const { PassThrough } = await import("node:stream");

        vi.doMock("node:zlib", async () => {
            const actual = await vi.importActual("node:zlib");
            return {
                ...actual,
                createUnzip: () => {
                    const pt = new PassThrough();
                    pt.on("pipe", () => {
                        queueMicrotask(() => {
                            pt.emit("error", new Error("bad gzip"));
                            pt.end();
                        });
                    });
                    return pt;
                },
            };
        });

        vi.resetModules();
        const httpMod = await import("@/utils/proxy/http");

        state.response.headers["content-encoding"] = "gzip";
        state.response.body = Buffer.from("hello");

        await httpMod.httpProxy("http://user:pass@example.com:8080/api/v2?apikey=secret&cmd=get#frag");

        expect(logger.error).toHaveBeenCalledWith(
            "Error decompressing the response from %s: %s",
            "http://example.com:8080/api/v2",
            "bad gzip"
        );
        expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(/secret|pass/);

        vi.doUnmock("node:zlib");
    });

    it("applies strict IPv4 agent options when FOYER_PROXY_DISABLE_IPV6 is true", async () => {
        process.env["FOYER_PROXY_DISABLE_IPV6"] = "true";
        const httpMod = await import("@/utils/proxy/http");

        await httpMod.httpProxy("http://example.com");

        expect(state.lastAgentOptions?.keepAlive).toBe(true);
        expect(state.lastAgentOptions?.family).toBe(4);
        expect(state.lastAgentOptions?.autoSelectFamily).toBe(false);
    });

    it("uses the https agent with rejectUnauthorized=false for https:// URLs", async () => {
        const httpMod = await import("@/utils/proxy/http");

        await httpMod.httpProxy("https://example.com");

        expect(state.lastAgentOptions?.rejectUnauthorized).toBe(false);
    });

    it("reuses the same keep-alive agent for repeated http requests", async () => {
        const httpMod = await import("@/utils/proxy/http");

        await httpMod.httpProxy("http://example.com/first");
        const firstAgent = state.lastAgent;
        await httpMod.httpProxy("http://example.com/second");

        expect(state.lastAgentOptions?.keepAlive).toBe(true);
        expect(state.lastAgent).toBe(firstAgent);
    });

    it("ends the request when the socket has been idle for the timeout", async () => {
        const httpMod = await import("@/utils/proxy/http");

        await httpMod.httpProxy("http://example.com", { timeout: 1500 });
        state.lastRequest!.emit("timeout");

        expect(state.lastRequest!.destroy).toHaveBeenCalledWith(
            expect.objectContaining({ message: "No data for 1500 ms" })
        );
    });

    it("returns an error response when the connection dies while the body arrives", async () => {
        state.responseError = new Error("connection reset");
        try {
            const httpMod = await import("@/utils/proxy/http");

            const [status, , data] = await httpMod.httpProxy("http://example.com");

            expect(status).toBe(500);
            expect((data as { error: { message: string } }).error.message).toBe("connection reset");
        } finally {
            state.responseError = null;
        }
    });

    it("returns a sanitized error response when the request fails", async () => {
        state.error = Object.assign(new Error("boom"), { code: "EHOSTUNREACH" });
        const httpMod = await import("@/utils/proxy/http");

        const [status, contentType, data] = await httpMod.httpProxy("http://example.com/?apikey=secret");
        const errorData = data as { error: { message: string; url: string } };

        expect(status).toBe(500);
        expect(contentType).toBe("application/json");
        expect(errorData.error.message).toBe("boom");
        expect(errorData.error.url).toBe("example.com (see logs for details)");
    });
});

describe("utils/proxy/http publicOnly", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.error = null;
        state.lastAgentOptions = null;
        net.isIP.mockReturnValue(0);
        vi.resetModules();
    });

    const getPublicLookup = async () => {
        const httpMod = await import("@/utils/proxy/http");
        await httpMod.httpProxy("http://example.com", { publicOnly: true });
        return state.lastAgentOptions!.lookup!;
    };

    it("lets a host that resolves to a public address connect", async () => {
        dns.lookup.mockImplementation((_hostname, _options, cb) => cb(null, "93.184.216.34", 4));
        const lookup = await getPublicLookup();
        const cb = vi.fn();

        lookup("example.com", {}, cb);

        expect(cb).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    });

    it("passes a lookup failure on without checking the address", async () => {
        const failure = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
        dns.lookup.mockImplementation((_hostname, _options, cb) => cb(failure));
        dns.resolve4.mockImplementation((_hostname, cb) => cb(failure, []));
        dns.resolve6.mockImplementation((_hostname, cb) => cb(failure, []));
        const lookup = await getPublicLookup();
        const cb = vi.fn();

        lookup("missing.example", {}, cb);

        expect(cb.mock.calls[0]?.[0]).toBe(failure);
    });

    it("refuses a host that resolves to a local network address", async () => {
        dns.lookup.mockImplementation((_hostname, _options, cb) => cb(null, "10.0.0.5", 4));
        const lookup = await getPublicLookup();
        const cb = vi.fn();

        lookup("internal.example", {}, cb);

        expect(cb.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ code: "EACCES" }));
    });

    it("refuses when any of several resolved addresses is not public", async () => {
        dns.lookup.mockImplementation((_hostname, _options, cb) =>
            cb(null, [
                { address: "93.184.216.34", family: 4 },
                { address: "127.0.0.1", family: 4 },
            ])
        );
        const lookup = await getPublicLookup();
        const cb = vi.fn();

        lookup("mixed.example", { all: true }, cb);

        expect(cb.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ code: "EACCES" }));
    });

    it("uses a separate agent from ordinary requests", async () => {
        const httpMod = await import("@/utils/proxy/http");
        await httpMod.httpProxy("http://example.com");
        const ordinary = state.lastAgent;
        await httpMod.httpProxy("http://example.com", { publicOnly: true });

        expect(state.lastAgent).not.toBe(ordinary);
    });
});
