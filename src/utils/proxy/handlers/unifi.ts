import type { IncomingHttpHeaders } from "node:http";

import type { ApiQueryValue, ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import cache from "@/utils/cache";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { addCookieToJar, setCookieHeader } from "@/utils/proxy/cookie-jar";
import { httpProxy } from "@/utils/proxy/http";
import widgets from "@/widgets/widgets";

type Logger = ReturnType<typeof createLogger>;

type UnifiLoginContext = {
    prefix?: string | undefined;
    req?: ApiRequest | undefined;
    widget?: WidgetConfig | undefined;
};

type UnifiAttemptLoginContext = {
    widget: WidgetConfig;
    req?: ApiRequest | undefined;
    responseHeaders?: IncomingHttpHeaders | null | undefined;
};

type UnifiRequestContextArgs = {
    cachedPrefix: string | null;
    logger: Logger;
    req: ApiRequest;
    service: ApiQueryValue;
    widget: WidgetConfig;
};

type UnifiRequestContext = {
    prefix: string;
    headers?: Record<string, string> | undefined;
    csrfToken?: string | string[] | undefined;
};

function isSuccessfulLoginResponse(data: unknown) {
    const json = JSON.parse(String(data)) as {
        meta?: { rc?: string | undefined };
        login_time?: unknown;
        update_time?: unknown;
    };
    return Boolean(json?.meta?.rc === "ok" || json?.login_time || json?.update_time);
}

async function login({
    widget,
    api,
    endpoint,
    csrfToken,
}: {
    widget: WidgetConfig;
    api: string;
    endpoint: string;
    csrfToken?: string | string[] | undefined;
}) {
    const loginUrl = new URL(formatApiCall(api.replace("{prefix}", ""), { endpoint, ...widget }));
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const token = Array.isArray(csrfToken) ? csrfToken[0] : csrfToken;
    if (token) {
        headers["X-CSRF-TOKEN"] = token;
    }

    return httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify({
            username: widget.username,
            password: widget.password,
            remember: true,
            rememberMe: true,
        }),
        headers,
    });
}

export default function createUnifiProxyHandler({
    proxyName,
    resolveWidget,
    resolveRequestContext,
    getLoginEndpoint = (_context: UnifiLoginContext) => "auth/login",
    shouldAttemptLogin = ({ widget }: UnifiAttemptLoginContext) => !widget.key,
}: {
    proxyName: string;
    resolveWidget: (req: ApiRequest, logger: Logger) => Promise<WidgetConfig | null>;
    resolveRequestContext: (args: UnifiRequestContextArgs) => Promise<UnifiRequestContext> | UnifiRequestContext;
    getLoginEndpoint?: ((context: UnifiLoginContext) => string) | undefined;
    shouldAttemptLogin?: ((context: UnifiAttemptLoginContext) => boolean) | undefined;
}) {
    const prefixCacheKey = `${proxyName}__prefix`;
    const logger = createLogger(proxyName);

    return async function unifiProxyHandler(req: ApiRequest, res: ApiResponse) {
        const widget = await resolveWidget(req, logger);
        const { service, endpoint } = req.query;

        if (!widget) {
            // the widget lookup has logged why
            return res.status(400).json({ error: "Invalid proxy service type" });
        }

        const api = widgets?.[widget.type]?.api;
        if (!api) {
            logger.warn("Service '%s' does not support API calls", service);
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        // reads the prefix found earlier, if any; nothing is loaded or stored here
        const cachedPrefix =
            (await cache.getOrFetch<string>(`${prefixCacheKey}.${service}`, async () => undefined, {
                type: "response",
            })) ?? null;
        const {
            prefix,
            headers = {},
            csrfToken: initialCsrfToken,
        } = await resolveRequestContext({
            cachedPrefix,
            logger,
            req,
            service,
            widget,
        });
        let csrfToken = initialCsrfToken;

        await cache.getOrFetch(`${prefixCacheKey}.${service}`, async () => prefix, { type: "response", refresh: true });

        widget["prefix"] = prefix;
        const url = new URL(formatApiCall(api, { endpoint, ...widget }));
        const params = { method: "GET", headers };
        setCookieHeader(url, params);

        let [status, contentType, data, responseHeaders] = await httpProxy(url, params);

        if (status === 401 && shouldAttemptLogin({ widget, req, responseHeaders })) {
            logger.debug("UniFi request was rejected, attempting login.");

            if (responseHeaders?.["x-csrf-token"]) {
                csrfToken = responseHeaders["x-csrf-token"];
            }

            [status, contentType, data, responseHeaders] = await login({
                api,
                csrfToken,
                endpoint: getLoginEndpoint({ prefix, req, widget }),
                widget,
            });

            if (status !== 200) {
                logger.error("HTTP %d logging in to UniFi. Data: %s", status, data);
                return res.status(status).json({ error: { message: `HTTP Error ${status}`, url, data } });
            }

            if (!isSuccessfulLoginResponse(data)) {
                logger.error("Error logging in to UniFi: Data: %s", data);
                return res.status(401).end(Buffer.isBuffer(data) || typeof data === "string" ? data : String(data));
            }

            addCookieToJar(url, responseHeaders);
            setCookieHeader(url, params, { overwrite: true });

            [status, contentType, data, responseHeaders] = await httpProxy(url, params);
        }

        if (status !== 200) {
            logger.error("HTTP %d getting data from UniFi endpoint %s. Data: %s", status, url.href, data);
            return res.status(status).json({ error: { message: `HTTP Error ${status}`, url, data } });
        }

        if (contentType) {
            res.setHeader("Content-Type", contentType);
        }

        return res.status(status).send(data);
    };
}
