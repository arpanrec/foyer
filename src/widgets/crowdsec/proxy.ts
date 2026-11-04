import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, dropSession, type SessionLogin } from "@/utils/proxy/session";
import type { CrowdsecLogin } from "@/widgets/crowdsec/types";
import widgets from "@/widgets/widgets";

const proxyName = "crowdsecProxyHandler";
const logger = createLogger(proxyName);
const sessionTokenCacheKey = `${proxyName}__sessionToken`;

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    const url = formatApiCall(widgets[widget.type]!.loginURL, widget);
    const [status, , data] = await httpProxy(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0", // Crowdsec requires a user-agent
        },
        body: JSON.stringify({
            machine_id: widget.username,
            password: widget.password,
            scenarios: [],
        }),
    });

    let dataParsed: CrowdsecLogin;
    try {
        dataParsed = JSON.parse(String(data)) as CrowdsecLogin;
    } catch {
        logger.error("Failed to parse Crowdsec login response, status: %d", status);
        return undefined;
    }

    if (status !== 200 || !dataParsed.token) {
        logger.error("Failed to login to Crowdsec API, status: %d", status);
        return undefined;
    }

    return { value: dataParsed.token, ttlMs: new Date(dataParsed.expire as string).getTime() - Date.now() };
}

// The cached token, or a new one from a login
function sessionToken(widget: WidgetConfig, service: string | string[]) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget));
}

export default async function crowdsecProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (!group || !service) {
        logger.error("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);
    if (!widget || !widgets[widget.type]?.api) {
        logger.error("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid widget configuration" });
    }

    const token = await sessionToken(widget, service);
    if (!token) {
        return res.status(500).json({ error: "Failed to authenticate with Crowdsec" });
    }

    const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));

    try {
        const params = {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0", // Crowdsec requires a user-agent
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        };

        logger.debug("Calling Crowdsec API endpoint: %s", endpoint);

        let [status, , data] = await httpProxy(url, params);

        if (status === 401) {
            logger.debug("Crowdsec API returned 401, refreshing token and retrying request");
            await dropSession(`${sessionTokenCacheKey}.${service}`);
            const refreshedToken = await sessionToken(widget, service);

            if (!refreshedToken) {
                return res.status(500).json({ error: "Failed to authenticate with Crowdsec" });
            }

            params.headers.Authorization = `Bearer ${refreshedToken}`;
            [status, , data] = await httpProxy(url, params);
        }

        if (status !== 200) {
            logger.error("Error calling Crowdsec API: %d. Data: %s", status, data);
            return res.status(status).json({ error: "Crowdsec API Error", data });
        }

        // Crowdsec returns a literal null instead of an empty array when nothing matches
        if (data != null && String(data).trim() === "null") {
            return res.status(status).json([]);
        }

        return res.status(status).send(data);
    } catch (error) {
        logger.error("Exception calling Crowdsec API: %s", errorMessage(error));
        return res.status(500).json({ error: "Crowdsec API Error", message: errorMessage(error) });
    }
}
