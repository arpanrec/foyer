import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { setCookieHeader } from "@/utils/proxy/cookie-jar";
import { httpProxy } from "@/utils/proxy/http";

const logger = createLogger("qbittorrentProxyHandler");

function toBody(data: unknown) {
    return typeof data === "string" || data instanceof Uint8Array ? data : undefined;
}

async function login(widget: WidgetConfig): Promise<[number, unknown]> {
    logger.debug("qBittorrent is rejecting the request, logging in.");
    const loginUrl = new URL(`${widget.url}/api/v2/auth/login`).toString();
    const loginBody = `username=${encodeURIComponent(String(widget.username))}&password=${encodeURIComponent(String(widget.password))}`;
    const loginParams = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginBody,
    };

    const [status, _contentType, data] = await httpProxy(loginUrl, loginParams);
    return [status, data];
}

export default async function qbittorrentProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (typeof group !== "string" || typeof service !== "string" || !group || !service) {
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const url = new URL(formatApiCall("{url}/api/v2/{endpoint}", { endpoint, ...widget }));
    const params: { method: string; headers: Record<string, string> } = { method: "GET", headers: {} };
    if (widget.key) params.headers.Authorization = `Bearer ${widget.key}`;

    let [status, contentType, data] = await httpProxy(url, params);
    if (status === 403 && !widget.key) {
        [status, data] = await login(widget);

        if (![200, 204].includes(status)) {
            logger.error("HTTP %d logging in to qBittorrent.  Data: %s", status, data);
            return res.status(status).end(toBody(data));
        }

        if (status === 200 && String(data) !== "Ok.") {
            logger.error("Error logging in to qBittorrent: Data: %s", data);
            return res.status(401).end(toBody(data));
        }

        // refresh the cookie header from the jar, otherwise the retry reuses the stale session cookie
        setCookieHeader(url, params, { overwrite: true });
        [status, contentType, data] = await httpProxy(url, params);
    }

    if (status !== 200) {
        logger.error("HTTP %d getting data from qBittorrent.  Data: %s", status, data);
    }

    if (contentType) res.setHeader("Content-Type", contentType);
    return res.status(status).send(data);
}
