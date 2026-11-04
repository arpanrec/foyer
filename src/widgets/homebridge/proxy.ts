import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, type SessionLogin } from "@/utils/proxy/session";
import type {
    HomebridgeChildBridge,
    HomebridgeLoginReply,
    HomebridgePlugin,
    HomebridgeStatusResponse,
    HomebridgeVersionResponse,
} from "@/widgets/homebridge/types";
import widgets from "@/widgets/widgets";

const proxyName = "homebridgeProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    const endpoint = "auth/login";
    const api = widgets?.[widget.type]?.api;
    const loginUrl = new URL(formatApiCall(api ?? "", { endpoint, ...widget }));
    const loginBody = { username: String(widget.username), password: String(widget.password) };
    const headers = { "Content-Type": "application/json" };

    const [, , data] = await httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify(loginBody),
        headers,
    });

    try {
        const { access_token: accessToken, expires_in: expiresIn } = JSON.parse(String(data)) as HomebridgeLoginReply;

        return { value: accessToken, ttlMs: expiresIn * 1000 - 5 * 60 * 1000 }; // expiresIn (s) - 5m
    } catch (e) {
        logger.error("Unable to login to Homebridge API: %s", e);
    }

    return undefined;
}

// The cached token, or a new one from a login; `refresh` logs in again
function sessionToken(widget: WidgetConfig, service: string | string[], refresh = false) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget), refresh);
}

async function apiCall<T>(widget: WidgetConfig, endpoint: string, service: string | string[]) {
    const headers = {
        "content-type": "application/json",
        Authorization: `Bearer ${await sessionToken(widget, service)}`,
    };

    const url = new URL(formatApiCall(widgets[widget.type]?.api ?? "", { endpoint, ...widget }));
    const method = "GET";

    let [status, contentType, data, responseHeaders] = await httpProxy(url, {
        method,
        headers,
    });

    if (status === 401 || status === 403) {
        logger.debug("Homebridge API rejected the request, attempting to obtain new session token");
        const accessToken = await sessionToken(widget, service, true);
        headers.Authorization = `Bearer ${accessToken}`;

        // retry the request, now with the new session token
        [status, contentType, data, responseHeaders] = await httpProxy(url, {
            method,
            headers,
        });
    }

    if (status !== 200) {
        logger.error("Error getting data from Homebridge: %s status %d. Data: %s", url, status, JSON.stringify(data));
        return { status, contentType, data: null, responseHeaders };
    }

    return { status, contentType, data: JSON.parse(String(data)) as T, responseHeaders };
}

export default async function homebridgeProxyHandler(req: ApiRequest, res: ApiResponse) {
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

    const { data: statusData } = await apiCall<HomebridgeStatusResponse>(widget, "status/homebridge", service);
    const { data: versionData } = await apiCall<HomebridgeVersionResponse>(
        widget,
        "status/homebridge-version",
        service
    );
    const { data: childBridgeData } = await apiCall<HomebridgeChildBridge[]>(
        widget,
        "status/homebridge/child-bridges",
        service
    );
    const { data: pluginsData } = await apiCall<HomebridgePlugin[]>(widget, "plugins", service);

    return res.status(200).send({
        status: statusData?.status,
        updateAvailable: versionData?.updateAvailable,
        plugins: {
            updatesAvailable: pluginsData?.filter((p) => p.updateAvailable).length,
        },
        childBridges: {
            running: childBridgeData?.filter((cb) => cb.status === "ok").length,
            total: childBridgeData?.length,
        },
    });
}
