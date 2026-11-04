/* eslint no-underscore-dangle: ["error", { "allow": ["_text", "_cdata"] }] */

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, type SessionLogin } from "@/utils/proxy/session";
import { xmlToCompact } from "@/utils/xml";
import type { QnapDocument } from "@/widgets/qnap/types";

const proxyName = "qnapProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

async function fetchLogin(widget: WidgetConfig): Promise<SessionLogin<string> | undefined> {
    const endpoint = "{url}/cgi-bin/authLogin.cgi";
    const loginUrl = new URL(formatApiCall(endpoint, widget));
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    const [, , data] = await httpProxy(loginUrl, {
        method: "POST",
        body: new URLSearchParams({
            user: String(widget.username),
            pwd: Buffer.from(`${widget.password}`).toString("base64"),
        }).toString(),
        headers,
    });

    try {
        const jsonData = xmlToCompact(String(data)) as unknown as QnapDocument;
        const token = jsonData.QDocRoot.authSid?._cdata;
        return token ? { value: token } : undefined;
    } catch (e) {
        logger.error("Unable to login to QNAP API: %s", e);
    }

    return undefined;
}

// The cached session id, or a new one from a login; `refresh` logs in again
function sessionToken(widget: WidgetConfig, service: string, refresh = false) {
    return cachedSession(`${sessionTokenCacheKey}.${service}`, () => fetchLogin(widget), refresh);
}

async function apiCall(widget: WidgetConfig, endpoint: string, service: string) {
    let key = await sessionToken(widget, service);

    let apiUrl = new URL(formatApiCall(`${endpoint}&sid=${key}`, widget));
    let [status, contentType, data, responseHeaders] = await httpProxy(apiUrl);

    if (status === 404) {
        logger.info("QNAP rejected the session for service '%s', logging in again", service);
        key = await sessionToken(widget, service, true);
        apiUrl = new URL(formatApiCall(`${endpoint}&sid=${key}`, widget));
        [status, contentType, data, responseHeaders] = await httpProxy(apiUrl);
    }

    if (status !== 200) {
        logger.error("Error getting data from QNAP: %s status %d. Data: %s", apiUrl, status, data);
        return { status, contentType, data: null, responseHeaders };
    }

    let dataDecoded = xmlToCompact(String(data)) as unknown as QnapDocument;

    if (dataDecoded.QDocRoot.authPassed._cdata === "0") {
        logger.info("QNAP rejected the session for service '%s', logging in again", service);
        key = await sessionToken(widget, service, true);
        apiUrl = new URL(formatApiCall(`${endpoint}&sid=${key}`, widget));
        [status, contentType, data, responseHeaders] = await httpProxy(apiUrl);

        if (status !== 200) {
            logger.error("Error getting data from QNAP: %s status %d. Data: %s", apiUrl, status, data);
            return { status, contentType, data: null, responseHeaders };
        }

        dataDecoded = xmlToCompact(String(data)) as unknown as QnapDocument;
    }

    return { status, contentType, data: dataDecoded, responseHeaders };
}

export default async function qnapProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;

    if (typeof group !== "string" || typeof service !== "string" || !group || !service) {
        logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const widget = await getServiceWidget(group, service, index);
    if (!widget) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const { data: systemStatsData } = await apiCall(
        widget,
        "{url}/cgi-bin/management/manaRequest.cgi?subfunc=sysinfo&hd=no&multicpu=1",
        service
    );
    const { data: volumeStatsData } = await apiCall(
        widget,
        "{url}/cgi-bin/management/chartReq.cgi?chart_func=disk_usage&disk_select=all&include=all",
        service
    );

    if (!systemStatsData || !volumeStatsData || !systemStatsData.QDocRoot.func) {
        return res.status(500).json({ error: "Unexpected response from QNAP API" });
    }

    return res.status(200).send({
        system: systemStatsData.QDocRoot.func.ownContent.root,
        volume: volumeStatsData.QDocRoot,
    });
}
