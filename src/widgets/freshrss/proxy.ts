import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, type SessionLogin } from "@/utils/proxy/session";
import type { FreshRssSubscriptions, FreshRssUnreadCount } from "@/widgets/freshrss/types";
import widgets from "@/widgets/widgets";

const proxyName = "freshrssProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    const endpoint = "accounts/ClientLogin";
    const api = widgets?.[widget.type]?.api;
    const loginUrl = new URL(formatApiCall(api, { endpoint, ...widget }));
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    const [, , data] = await httpProxy(loginUrl, {
        method: "POST",
        body: new URLSearchParams({
            Email: String(widget.username),
            Passwd: String(widget.password),
        }).toString(),
        headers,
    });

    try {
        const authLine = (data as Buffer)
            .toString()
            .split("\n")
            .find((line: string) => line.startsWith("Auth="));
        if (!authLine) throw new Error("No Auth token in the login response");
        const [, token] = authLine.split("=");
        return token === undefined ? undefined : { value: token };
    } catch (e) {
        logger.error("Unable to login to FreshRSS API: %s", e);
    }

    return undefined;
}

// The cached token, or a new one from a login; `refresh` logs in again
function sessionToken(widget: WidgetConfig, service: string, refresh = false) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget), refresh);
}

async function apiCall<T>(
    widget: WidgetConfig,
    endpoint: string,
    service: string
): Promise<{ status: number; contentType: string | undefined; data: T | null; responseHeaders: unknown }> {
    const headers = {
        Authorization: `GoogleLogin auth=${await sessionToken(widget, service)}`,
    };
    const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));
    const method = "GET";

    let [status, contentType, data, responseHeaders] = await httpProxy(url, {
        method,
        headers,
    });

    if (status === 401) {
        logger.debug("FreshRSS API rejected the request, attempting to obtain new session token");
        const token = await sessionToken(widget, service, true);
        headers.Authorization = `GoogleLogin auth=${token}`;

        // retry the request, now with the new session token
        [status, contentType, data, responseHeaders] = await httpProxy(url, {
            method,
            headers,
        });
    }

    if (status !== 200) {
        logger.error("Error getting data from FreshRSS: %s status %d. Data: %s", url, status, data);
        return { status, contentType, data: null, responseHeaders };
    }

    return { status, contentType, data: JSON.parse((data as Buffer).toString()), responseHeaders };
}

export default async function freshrssProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (!group || !service || typeof service !== "string") {
        logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);
    if (!widget) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const { data: subscriptionData } = await apiCall<FreshRssSubscriptions>(
        widget,
        "reader/api/0/subscription/list",
        service
    );
    const { data: unreadCountData } = await apiCall<FreshRssUnreadCount>(widget, "reader/api/0/unread-count", service);

    return res.status(200).send({
        subscriptions: subscriptionData?.subscriptions.length,
        unread: unreadCountData?.max,
    });
}
