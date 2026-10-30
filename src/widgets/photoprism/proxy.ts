import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { asJson, formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { PhotoprismSession } from "@/widgets/photoprism/types";

const logger = createLogger("photoprismProxyHandler");

export default async function photoprismProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const url = new URL(formatApiCall("{url}/api/v1/session", { ...widget }));
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: string | undefined;

    if (widget.username && widget.password) {
        body = JSON.stringify({
            username: widget.username,
            password: widget.password,
        });
    } else if (widget.key) {
        headers.Authorization = `Bearer ${widget.key}`;
        body = JSON.stringify({
            authToken: widget.key,
        });
    }

    const [status, contentType, data] = await httpProxy(url, { method: "POST", headers, body });

    if (status !== 200) {
        logger.error("HTTP %d getting data from PhotoPrism. Data: %s", status, data);
        return res.status(status).json({ error: { message: `HTTP Error ${status}`, url, data } });
    }

    const json = asJson<PhotoprismSession>(data);

    if (contentType) res.setHeader("Content-Type", contentType);
    return res.status(200).send(json?.config?.count);
}
