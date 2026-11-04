import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, type SessionLogin } from "@/utils/proxy/session";
import type { KavitaStats } from "@/widgets/kavita/types";
import widgets from "@/widgets/widgets";

const proxyName = "kavitaProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    const endpoint = "Account/login";
    const api = widgets?.[widget.type]?.api;
    const loginUrl = new URL(formatApiCall(api, { endpoint, ...widget }));
    const loginBody = {
        username: "",
        password: "",
        apiKey: "",
    };
    if (widget.username && widget.password) {
        loginBody.username = widget.username;
        loginBody.password = widget.password;
    } else if (widget.key) {
        loginBody.apiKey = widget.key;
    }
    const headers = { "Content-Type": "application/json", accept: "text/plain" };

    const [, , data] = await httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify(loginBody),
        headers,
    });

    try {
        const { token: accessToken } = JSON.parse(String(data));
        return { value: accessToken };
    } catch (e) {
        logger.error("Unable to login to Kavita API: %s", e);
    }

    return undefined;
}

// The cached token, or a new one from a login; `refresh` logs in again
function sessionToken(widget: WidgetConfig, service: string | string[], refresh = false) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget), refresh);
}

async function apiCall(widget: WidgetConfig, endpoint: string, service: string | string[]) {
    const headers = {
        "content-type": "application/json",
        Authorization: `Bearer ${await sessionToken(widget, service)}`,
    };

    const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));
    const method = "GET";

    let [status, contentType, data, responseHeaders] = await httpProxy(url, {
        method,
        headers,
    });

    if (status === 401 || status === 403) {
        logger.debug("Kavita API rejected the request, attempting to obtain new session token");
        const accessToken = await sessionToken(widget, service, true);
        headers.Authorization = `Bearer ${accessToken}`;

        // retry the request, now with the new session token
        [status, contentType, data, responseHeaders] = await httpProxy(url, {
            method,
            headers,
        });
    }

    if (status !== 200) {
        logger.error("Error getting data from Kavita: %s status %d. Data: %s", url, status, data);
        return { status, contentType, data: null as KavitaStats | null, responseHeaders };
    }

    return { status, contentType, data: JSON.parse(String(data)) as KavitaStats, responseHeaders };
}

export default async function KavitaProxyHandler(req: ApiRequest, res: ApiResponse) {
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

    const { data: statsData } = await apiCall(widget, "Stats/server/stats", service);

    return res.status(200).send({
        seriesCount: statsData?.seriesCount,
        totalFiles: statsData?.totalFiles,
    });
}
