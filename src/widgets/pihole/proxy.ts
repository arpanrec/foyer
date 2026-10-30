import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { asJson, formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { PiholeAuthResponse, PiholeOptions, PiholeV6Summary } from "@/widgets/pihole/types";
import widgets from "@/widgets/widgets";

const proxyName = "piholeProxyHandler";
const logger = createLogger(proxyName);
const sessionSIDCacheKey = `${proxyName}__sessionSID`;

// The URL templates in the widget definition; a missing one formats to an empty URL
function apiTemplate(template: unknown): string {
    return typeof template === "string" ? template : "";
}

async function login(widget: WidgetConfig, service: string | string[]) {
    const url = formatApiCall(apiTemplate(widgets[widget.type].api), { ...widget, endpoint: "auth" });
    const [status, , data] = await httpProxy(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            password: widget.key,
        }),
    });

    const dataParsed = asJson<PiholeAuthResponse>(data);

    if (status !== 200 || !dataParsed.session) {
        logger.error("Failed to login to Pi-Hole API, status: %d", status);
        cache.del(`${sessionSIDCacheKey}.${service}`);
    } else {
        cache.put(
            `${sessionSIDCacheKey}.${service}`,
            dataParsed.session.sid,
            Math.min(2147483647, dataParsed.session.validity * 1000) // https://github.com/ptarjan/node-cache/issues/84
        );
    }
}

export default async function piholeProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    let endpoint = "stats/summary";

    if (!group || !service) {
        logger.error("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = (await getServiceWidget(group, service, index)) as (WidgetConfig & PiholeOptions) | undefined;
    if (!widget) {
        logger.error("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid widget configuration" });
    }

    let status;
    let data;
    if (!widget.version || widget.version < 6) {
        // pihole v5
        endpoint = "summaryRaw";
        [status, , data] = await httpProxy(
            formatApiCall(apiTemplate(widgets[widget.type].apiv5), { ...widget, endpoint })
        );
        return res.status(status).send(data);
    }

    // pihole v6
    if (!cache.get(`${sessionSIDCacheKey}.${service}`) && widget.key) {
        await login(widget, service);
    }

    const sid = cache.get(`${sessionSIDCacheKey}.${service}`);
    if (widget.key && !sid) {
        return res.status(500).json({ error: "Failed to authenticate with Pi-hole" });
    }

    try {
        logger.debug("Calling Pi-hole API endpoint: %s", endpoint);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (sid) {
            headers["X-FTL-SID"] = sid;
        } else {
            logger.debug("Pi-hole request is unauthenticated");
        }
        [status, , data] = await httpProxy(
            formatApiCall(apiTemplate(widgets[widget.type].api), { ...widget, endpoint }),
            {
                headers,
            }
        );

        if (status !== 200) {
            logger.error("Error calling Pi-Hole API: %d. Data: %s", status, data);
            return res.status(status).json({ error: "Pi-Hole API Error", data });
        }

        const dataParsed = asJson<PiholeV6Summary>(data);
        return res.status(status).json({
            domains_being_blocked: dataParsed.gravity.domains_being_blocked,
            ads_blocked_today: dataParsed.queries.blocked,
            ads_percentage_today: dataParsed.queries.percent_blocked,
            dns_queries_today: dataParsed.queries.total,
        });
    } catch (error) {
        logger.error("Exception calling Pi-Hole API: %s", errorMessage(error));
        return res.status(500).json({ error: "Pi-Hole API Error", message: errorMessage(error) });
    }
}
