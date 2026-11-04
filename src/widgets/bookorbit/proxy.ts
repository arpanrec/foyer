import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, dropSession, type SessionLogin } from "@/utils/proxy/session";
import type { BookorbitLibrarySummary, BookorbitReadingSummary, BookorbitTokens } from "@/widgets/bookorbit/types";
import widgets from "@/widgets/widgets";

const proxyName = "bookorbitProxyHandler";
const accessTokenCacheKey = `${proxyName}__accessToken`;
const refreshTokenCacheKey = `${proxyName}__refreshToken`;
const logger = createLogger(proxyName);

async function requestTokens(
    widget: WidgetConfig,
    service: string | string[],
    endpoint: string,
    body: Record<string, string | undefined>
): Promise<BookorbitTokens | null> {
    const url = new URL(formatApiCall(widgets[widget.type]!.api, { ...widget, endpoint }));
    const [status, , data] = await httpProxy(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
    });

    if (status !== 200) {
        logger.error("BookOrbit %s failed for service '%s' with status %d", endpoint, service, status);
        return null;
    }

    try {
        const tokens = JSON.parse(String(data)) as BookorbitTokens;
        if (tokens.accessToken) return tokens;
    } catch (e) {
        logger.error("Unable to parse BookOrbit %s response: %s", endpoint, e);
    }

    return null;
}

// Keeps the refresh token for the next time the access token has to be replaced, and hands the access token on
async function keepTokens(service: string | string[], tokens: BookorbitTokens): Promise<SessionLogin<string>> {
    // expired tokens are replaced when a request gets a 401
    if (tokens.refreshToken) {
        const { refreshToken } = tokens;
        await cachedSession(`${refreshTokenCacheKey}.${service}`, async () => ({ value: refreshToken }), true);
    }
    return { value: tokens.accessToken as string };
}

// A new access token: from the refresh token when there is one, else from a login
async function obtainAccessToken(
    widget: WidgetConfig,
    service: string | string[]
): Promise<SessionLogin<string> | undefined> {
    const refreshKey = `${refreshTokenCacheKey}.${service}`;
    // reads the refresh token kept earlier, if any; nothing is loaded here
    const refreshToken = await cachedSession<string>(refreshKey, async () => undefined);
    if (refreshToken) {
        const refreshed = await requestTokens(widget, service, "auth/refresh", { refreshToken });
        if (refreshed) return keepTokens(service, refreshed);
        await dropSession(refreshKey);
    }

    // native clients get the refresh token in the body
    const tokens = await requestTokens(widget, service, "auth/login", {
        username: widget.username,
        password: widget.password,
        clientKind: "native",
        deviceLabel: "Foyer",
    });
    return tokens ? keepTokens(service, tokens) : undefined;
}

async function loginOrRefresh(widget: WidgetConfig, service: string | string[], forceNew = false) {
    return (
        (await cachedSession(
            `${accessTokenCacheKey}.${service}`,
            () => obtainAccessToken(widget, service),
            forceNew
        )) ?? null
    );
}

async function apiCall<T>(
    widget: WidgetConfig,
    endpoint: string,
    service: string | string[]
): Promise<{ status: number; data: T | null }> {
    const url = new URL(formatApiCall(widgets[widget.type]!.api, { ...widget, endpoint }));
    const request = async (accessToken: string) =>
        httpProxy(url, {
            method: "GET",
            headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` },
        });

    let accessToken = await loginOrRefresh(widget, service);
    if (!accessToken) return { status: 401, data: null };

    let [status, , data] = await request(accessToken);

    if (status === 401) {
        logger.debug("BookOrbit API rejected the request, attempting to obtain a new access token");
        await dropSession(`${accessTokenCacheKey}.${service}`);
        accessToken = await loginOrRefresh(widget, service, true);
        if (!accessToken) return { status, data: null };
        [status, , data] = await request(accessToken);
    }

    if (status !== 200) {
        logger.error("Error getting data from BookOrbit: %s status %d. Data: %s", url, status, data);
        return { status, data: null };
    }

    try {
        return { status, data: JSON.parse(String(data)) as T };
    } catch (e) {
        logger.error("Error parsing BookOrbit response: %s", e);
    }

    return { status: 500, data: null };
}

export default async function bookorbitProxyHandler(req: ApiRequest, res: ApiResponse) {
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

    if (!widget.username || !widget.password) {
        logger.warn("Missing credentials for BookOrbit widget in service '%s'", service);
        return res.status(400).json({ error: "Missing BookOrbit credentials" });
    }

    const library = await apiCall<BookorbitLibrarySummary>(widget, "statistics/summary", service);
    if (!library.data) {
        return res.status(library.status).json({ error: "Error fetching BookOrbit library statistics" });
    }

    const reading = await apiCall<BookorbitReadingSummary>(widget, "user-statistics/summary", service);
    if (!reading.data) {
        return res.status(reading.status).json({ error: "Error fetching BookOrbit reading statistics" });
    }

    return res.status(200).json({
        books: library.data.totalBooks,
        authors: library.data.totalAuthors,
        series: library.data.totalSeries,
        storage: library.data.totalStorageBytes,
        reading: reading.data.inProgressBooks,
        finished: reading.data.completedBooks,
    });
}
