import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetMapFn } from "@/types/widget-definition";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall, getProxyError, sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import type { HttpProxyParams } from "@/utils/proxy/http";
import { httpProxy } from "@/utils/proxy/http";
import validateWidgetData from "@/utils/proxy/validate-widget-data";
import widgets from "@/widgets/widgets";

const logger = createLogger("genericProxyHandler");

export default async function genericProxyHandler(req: ApiRequest, res: ApiResponse, map?: WidgetMapFn) {
    const { group, service, endpoint, index } = req.query;

    if (group && service && typeof group === "string" && typeof service === "string") {
        const widget = await getServiceWidget(group, service, index);

        const api = widget ? widgets[widget.type]?.api : undefined;
        if (!widget || !api) {
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        if (widget) {
            // if there are more than one question marks, replace others to &
            let urlString = formatApiCall(api, { endpoint, ...widget }).replace(/(?<=\?.*)\?/g, "&");
            if (widget.type === "customapi" && widget.url?.endsWith("/")) {
                urlString += "/"; // Ensure we dont lose the trailing slash for custom API calls
            }
            const url = new URL(urlString);

            const headers: Record<string, string | undefined> = {
                ...(widgets[widget.type].headers ?? {}),
                ...(widget.headers ?? {}),
                ...(req.extraHeaders ?? {}),
            };

            if (widget.username && widget.password) {
                headers.Authorization = `Basic ${Buffer.from(`${widget.username}:${widget.password}`).toString("base64")}`;
            }

            const params: HttpProxyParams = {
                method: widget.method ?? req.method,
                headers,
            };
            if (req.body && (typeof req.body === "string" || Buffer.isBuffer(req.body))) {
                params.body = req.body;
            } else if (widget.requestBody) {
                if (typeof widget.requestBody === "object") {
                    params.body = JSON.stringify(widget.requestBody);
                } else {
                    params.body = String(widget.requestBody);
                }
            }

            const [status, contentType, data, responseHeaders] = await httpProxy(url, params);

            let resultData = data;

            const upstreamError = getProxyError(resultData);
            if (upstreamError?.url) {
                upstreamError.url = sanitizeErrorURL(url);
            }

            if (status === 200) {
                if (!validateWidgetData(widget, endpoint, resultData)) {
                    return res
                        .status(status)
                        .json({ error: { message: "Invalid data", url: sanitizeErrorURL(url), data: resultData } });
                }
                if (map) resultData = map(resultData, responseHeaders);
            }

            if (contentType) res.setHeader("Content-Type", contentType);

            if (status === 204 || status === 304) {
                return res.status(status).end();
            }

            if (status >= 400) {
                logger.debug(
                    "HTTP Error %d calling %s//%s%s%s...",
                    status,
                    url.protocol,
                    url.hostname,
                    url.port ? `:${url.port}` : "",
                    url.pathname
                );
                return res.status(status).json({
                    error: {
                        message: "HTTP Error",
                        url: sanitizeErrorURL(url),
                        data: Buffer.isBuffer(resultData) ? resultData.toString() : resultData,
                    },
                });
            }

            return res.status(status).send(resultData);
        }
    }

    logger.debug("Invalid or missing proxy service type '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
}
