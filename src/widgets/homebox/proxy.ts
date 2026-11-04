import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, type SessionLogin } from "@/utils/proxy/session";
import type { HomeboxGroupData, HomeboxGroupStatistics, HomeboxLoginReply } from "@/widgets/homebox/types";

const proxyName = "homeboxProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    logger.debug("Homebox is rejecting the request, logging in.");

    const loginUrl = new URL(`${widget.url}/api/v1/users/login`).toString();
    const loginBody = `username=${encodeURIComponent(String(widget.username))}&password=${encodeURIComponent(String(widget.password))}`;
    const loginParams = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginBody,
    };

    const [, , data] = await httpProxy(loginUrl, loginParams);

    try {
        const { token, expiresAt } = JSON.parse(String(data)) as HomeboxLoginReply;
        const expiresAtDate = new Date(expiresAt).getTime();
        return { value: token, ttlMs: expiresAtDate - Date.now() };
    } catch (e) {
        logger.error("Unable to login to Homebox API: %s", e);
    }

    return undefined;
}

// The cached token, or a new one from a login; `refresh` logs in again
function sessionToken(widget: WidgetConfig, service: string | string[], refresh = false) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget), refresh);
}

async function apiCall<T>(widget: WidgetConfig, endpoint: string, service: string | string[]) {
    const url = new URL(formatApiCall("{url}/api/v1/{endpoint}", { endpoint, ...widget }));
    const headers = {
        "Content-Type": "application/json",
        Authorization: `${await sessionToken(widget, service)}`,
    };
    const params = { method: "GET", headers };

    let [status, contentType, data, responseHeaders] = await httpProxy(url, params);

    if (status === 401 || status === 403) {
        logger.debug("Homebox API rejected the request, attempting to obtain new access token");
        const token = await sessionToken(widget, service, true);
        headers.Authorization = `${token}`;

        // retry request with new token
        [status, contentType, data, responseHeaders] = await httpProxy(url, params);

        if (status !== 200) {
            logger.error("HTTP %d logging in to Homebox, data: %s", status, data);
            return { status, contentType, data: null, responseHeaders };
        }
    }

    if (status !== 200) {
        logger.error("HTTP %d getting data from Homebox, data: %s", status, data);
        return { status, contentType, data: null, responseHeaders };
    }

    return { status, contentType, data: JSON.parse(String(data)) as T, responseHeaders };
}

export default async function homeboxProxyHandler(req: ApiRequest, res: ApiResponse) {
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

    // Get stats for the main blocks
    const { data: groupStats } = await apiCall<HomeboxGroupStatistics>(widget, "groups/statistics", service);

    // Get group info for currency
    const { data: groupData } = await apiCall<HomeboxGroupData>(widget, "groups", service);

    return res.status(200).send({
        items: groupStats?.totalItems,
        locations: groupStats?.totalLocations,
        labels: groupStats?.totalLabels,
        totalWithWarranty: groupStats?.totalWithWarranty,
        totalValue: groupStats?.totalItemPrice,
        users: groupStats?.totalUsers,
        currencyCode: groupData?.currency,
    });
}
