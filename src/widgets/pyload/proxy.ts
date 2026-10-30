import type { IncomingHttpHeaders } from "node:http";

import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetMapFn } from "@/types/widget-definition";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { PyloadRequestOptions } from "@/widgets/pyload/types";
import widgets from "@/widgets/widgets";

const proxyName = "pyloadProxyHandler";
const logger = createLogger(proxyName);
const sessionCacheKey = `${proxyName}__sessionId`;
const isNgCacheKey = `${proxyName}__isNg`;

type PyloadParams = Record<string, string | undefined>;
type PyloadResult = [status: number, data: unknown, headers: IncomingHttpHeaders | null];

// The `error` field of a pyload response body, when it has one
function getPyloadError(data: unknown): unknown {
    return typeof data === "object" && data !== null && "error" in data ? data.error : undefined;
}

function isCsrfError(data: unknown) {
    const error = getPyloadError(data);
    return typeof error === "string" && error.includes("CSRF token");
}

function parsePyloadResponse(url: string | URL, data: unknown): unknown {
    try {
        if (typeof data !== "string" && !Buffer.isBuffer(data)) throw new TypeError("Unexpected pyload response body");
        return JSON.parse(Buffer.from(data).toString());
    } catch (e) {
        logger.error(`Error communicating with pyload API at ${url}, returned: ${JSON.stringify(data)}`);
        return data;
    }
}

async function fetchFromPyloadAPI(
    url: URL | string,
    sessionId: unknown,
    params: PyloadParams | null,
    service: string
): Promise<PyloadResult> {
    const options: PyloadRequestOptions = {
        body: params
            ? Object.keys(params)
                  .map((prop) => `${prop}=${encodeURIComponent(String(params[prop]))}`)
                  .join("&")
            : `session=${sessionId}`,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    };

    // see https://github.com/gethomepage/homepage/issues/517
    const isNg = cache.get(`${isNgCacheKey}.${service}`);
    if (isNg && !params) {
        delete options.body;
        options.headers.Cookie = cache.get(`${sessionCacheKey}.${service}`);
    }

    const [status, _contentType, data, responseHeaders] = await httpProxy(url, options);
    const returnData = parsePyloadResponse(url, data);
    return [status, returnData, responseHeaders];
}

async function fetchFromPyloadAPIWithCredentials(
    url: URL,
    params: PyloadParams | null,
    username?: string,
    password?: string,
    key?: string
): Promise<PyloadResult> {
    const parsedUrl = new URL(url);
    const isGetRequest = !params || Object.keys(params).length === 0;

    const options: PyloadRequestOptions = {
        headers: {},
        method: isGetRequest ? "GET" : "POST",
    };

    if (key) {
        options.headers = { "X-API-Key": key };
    } else {
        options.headers = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
    }

    if (isGetRequest) {
        if (params) {
            Object.keys(params).forEach((key) => parsedUrl.searchParams.append(key, String(params[key])));
        }
    } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(params);
    }

    const [status, _contentType, data, responseHeaders] = await httpProxy(parsedUrl, options);
    const returnData = parsePyloadResponse(parsedUrl, data);
    return [status, returnData, responseHeaders];
}

async function login(loginUrl: string, service: string, username?: string, password = "") {
    const [status, sessionId, responseHeaders] = await fetchFromPyloadAPI(
        loginUrl,
        null,
        { username, password },
        service
    );

    // this API actually returns status 200 even on login failure
    if (status !== 200 || sessionId === false) {
        logger.error(`HTTP ${status} logging into Pyload API, returned: ${JSON.stringify(sessionId)}`);
    } else if (responseHeaders?.["set-cookie"]?.join().includes("pyload_session")) {
        // Support pyload-ng, see https://github.com/gethomepage/homepage/issues/517
        cache.put(`${isNgCacheKey}.${service}`, true);
        const sessionCookie = responseHeaders["set-cookie"][0];
        cache.put(`${sessionCacheKey}.${service}`, sessionCookie, 60 * 60 * 23 * 1000); // cache for 23h
    } else {
        cache.put(`${sessionCacheKey}.${service}`, sessionId);
    }

    return sessionId;
}

export default async function pyloadProxyHandler(
    req: ApiRequest,
    res: ApiResponse,
    map: WidgetMapFn | Record<string, unknown> = {}
) {
    const { group, service, endpoint, index } = req.query;
    const ngEndpoint = typeof map === "function" || typeof map.ngEndpoint !== "string" ? undefined : map.ngEndpoint;

    try {
        if (typeof group === "string" && typeof service === "string") {
            const widget = await getServiceWidget(group, service, index);

            if (widget) {
                const apiTemplate = widgets[widget.type].api;
                if (!apiTemplate) throw new TypeError("Pyload widget has no api template");
                const url = new URL(formatApiCall(apiTemplate, { endpoint, ...widget }));
                const ngUrl = ngEndpoint
                    ? new URL(formatApiCall(apiTemplate, { endpoint: ngEndpoint, ...widget }))
                    : url;
                const loginUrl = `${widget.url}/api/login`;
                const hasCredentials = widget.key || (widget.username && widget.password);

                if (hasCredentials) {
                    const [status, data] = await fetchFromPyloadAPIWithCredentials(
                        ngUrl,
                        null,
                        widget.username,
                        widget.password,
                        widget.key
                    );

                    if (status === 200 && !getPyloadError(data)) {
                        cache.put(`${isNgCacheKey}.${service}`, true);
                        return res.json(data);
                    }

                    if (status === 401) {
                        return res
                            .status(status)
                            .send({ error: "Invalid credentials communicating with Pyload API", data });
                    }
                }

                let sessionId =
                    cache.get(`${sessionCacheKey}.${service}`) ??
                    (await login(loginUrl, service, widget.username, widget.password));
                let [status, data] = await fetchFromPyloadAPI(url, sessionId, null, service);

                if (status === 403 || status === 401 || (status === 400 && isCsrfError(data))) {
                    logger.info("Failed to retrieve data from Pyload API with session auth, trying to login again...");
                    cache.del(`${sessionCacheKey}.${service}`);
                    sessionId = await login(loginUrl, service, widget.username, widget.password);
                    [status, data] = await fetchFromPyloadAPI(url, sessionId, null, service);
                }

                if (getPyloadError(data) || status !== 200) {
                    if (typeof data === "string" || Buffer.isBuffer(data)) {
                        return res.status(status).send({
                            error: {
                                message: "HTTP error communicating with Pyload API",
                                data: Buffer.from(data).toString(),
                            },
                        });
                    }
                    return res
                        .status(status)
                        .send({ error: { message: "HTTP error communicating with Pyload API", data } });
                }

                return res.json(data);
            }
        }
    } catch (e) {
        if (e) logger.error(e);
        return res.status(500).send({ error: { message: `Error communicating with Pyload API: ${String(e)}` } });
    }

    return res.status(400).json({ error: "Invalid proxy service type" });
}
