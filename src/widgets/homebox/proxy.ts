import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { HomeboxGroupData, HomeboxGroupStatistics, HomeboxLoginReply } from "@/widgets/homebox/types";

const proxyName = "homeboxProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function login(widget: WidgetConfig, service: string | string[]) {
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
        cache.put(`${sessionTokenCacheKey}.${service}`, token, expiresAtDate - Date.now());
        return { token };
    } catch (e) {
        logger.error("Unable to login to Homebox API: %s", e);
    }

    return { token: false };
}

async function apiCall<T>(widget: WidgetConfig, endpoint: string, service: string | string[]) {
    const key = `${sessionTokenCacheKey}.${service}`;
    const url = new URL(formatApiCall("{url}/api/v1/{endpoint}", { endpoint, ...widget }));
    const headers = {
        "Content-Type": "application/json",
        Authorization: `${cache.get(key)}`,
    };
    const params = { method: "GET", headers };

    let [status, contentType, data, responseHeaders] = await httpProxy(url, params);

    if (status === 401 || status === 403) {
        logger.debug("Homebox API rejected the request, attempting to obtain new access token");
        const { token } = await login(widget, service);
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
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);
    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    if (!cache.get(`${sessionTokenCacheKey}.${service}`)) {
        await login(widget, service);
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
