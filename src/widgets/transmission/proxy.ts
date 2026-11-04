import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession } from "@/utils/proxy/session";
import widgets from "@/widgets/widgets";

const proxyName = "transmissionProxyHandler";
const headerCacheKey = `${proxyName}__headers`;
const logger = createLogger(proxyName);

export default async function transmissionProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    // the headers kept for this service, which carry the CSRF token once Transmission has handed one out
    const headersKey = `${headerCacheKey}.${service}`;
    const headers = (await cachedSession<Record<string, string | number | string[] | undefined>>(
        headersKey,
        async () => ({
            value: { "content-type": "application/json" },
        })
    ))!;

    const api = `${widget.url}${widget["rpcUrl"] || widgets[widget.type]!.rpcUrl}rpc`;

    const url = new URL(formatApiCall(api, { endpoint: undefined, ...widget }));
    const csrfHeaderName = "x-transmission-session-id";

    const method = "POST";
    const auth = `${widget.username}:${widget.password}`;
    const body = JSON.stringify({
        method: "torrent-get",
        arguments: {
            fields: ["percentDone", "status", "rateDownload", "rateUpload"],
        },
    });

    let [status, contentType, data, responseHeaders] = await httpProxy(url, {
        method,
        auth,
        body,
        headers,
    });

    if (status === 409) {
        logger.debug("Transmission is rejecting the request, but returning a CSRF token");
        headers[csrfHeaderName] = responseHeaders?.[csrfHeaderName];
        await cachedSession(headersKey, async () => ({ value: headers }), true);

        // retry the request, now with the CSRF token
        [status, contentType, data, responseHeaders] = await httpProxy(url, {
            method,
            auth,
            body,
            headers,
        });
    }

    if (status !== 200) {
        logger.error("Error getting data from Transmission: %d.  Data: %s", status, data);
        return res.status(500).send({ error: { message: "Error getting data from Transmission", url, data } });
    }

    if (contentType) res.setHeader("Content-Type", contentType);
    return res.status(status).send(data);
}
