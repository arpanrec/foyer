import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { asJson, formatApiCall, parseVersionForUrl } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import widgets from "@/widgets/widgets";

const INFO_ENDPOINT = "{url}/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query";
const AUTH_ENDPOINT =
    "{url}/webapi/{path}?api=SYNO.API.Auth&version={maxVersion}&method=login&account={username}&passwd={password}&session=DownloadStation&format=cookie";
const AUTH_API_NAME = "SYNO.API.Auth";

type SynologyError = { code?: number };

// What the DSM web API answers, for the info, login and data calls
type SynologyResponse = {
    success?: boolean;
    error?: SynologyError | number;
    code?: number;
    message?: string;
    data?: Record<string, { path?: string; maxVersion?: unknown } | undefined>;
};

type ProxyResult = [status: number, contentType: string | undefined, data: unknown];

const proxyName = "synologyProxyHandler";
const logger = createLogger(proxyName);

async function login(loginUrl: string): Promise<ProxyResult> {
    const [status, contentType, data] = await httpProxy(loginUrl);
    if (status !== 200) {
        return [status, contentType, data];
    }

    const json = asJson<SynologyResponse>(data);
    if (json?.success !== true) {
        // from page 16: https://global.download.synology.com/download/Document/Software/DeveloperGuide/Os/DSM/All/enu/DSM_Login_Web_API_Guide_enu.pdf
        /*
      Code Description
      400  No such account or incorrect password
      401  Account disabled
      402  Permission denied
      403  2-step verification code required
      404  Failed to authenticate 2-step verification code
    */
        let message = "Authentication failed.";
        const errorCode = typeof json?.error === "object" ? json.error.code : undefined;
        if (errorCode !== undefined && errorCode >= 403) message += " 2FA enabled.";
        logger.warn("Unable to login.  Code: %d", errorCode);
        return [401, "application/json", JSON.stringify({ code: errorCode, message })];
    }

    return [status, contentType, data];
}

async function getApiInfo(
    serviceWidget: WidgetConfig,
    apiName: string | undefined,
    serviceName: string
): Promise<[cgiPath: string | null | undefined, maxVersion: number | null | undefined]> {
    const cacheKey = `${proxyName}__${apiName}__${serviceName}`;
    let { cgiPath, maxVersion }: { cgiPath?: string; maxVersion?: number | null } = cache.get(cacheKey) ?? {};
    if (cgiPath && maxVersion) {
        return [cgiPath, maxVersion];
    }

    const infoUrl = formatApiCall(INFO_ENDPOINT, serviceWidget);

    const [status, _contentType, data] = await httpProxy(infoUrl);

    if (status === 200) {
        try {
            const json = asJson<SynologyResponse>(data);
            const apiInfo = apiName ? json?.data?.[apiName] : undefined;
            if (apiInfo) {
                cgiPath = apiInfo.path;
                maxVersion = parseVersionForUrl(apiInfo.maxVersion);
                logger.debug(
                    `Detected ${serviceWidget.type}: apiName '${apiName}', cgiPath '${cgiPath}', and maxVersion ${maxVersion}`
                );
                cache.put(cacheKey, { cgiPath, maxVersion });
                return [cgiPath, maxVersion];
            }
        } catch {
            logger.warn(`Error ${status} obtaining ${apiName} info`);
        }
    }

    return [null, null];
}

async function handleUnsuccessfulResponse(
    serviceWidget: WidgetConfig,
    url: string,
    serviceName: string
): Promise<ProxyResult> {
    logger.debug(`Attempting login to ${serviceWidget.type}`);

    const [apiPath, maxVersion] = await getApiInfo(serviceWidget, AUTH_API_NAME, serviceName);

    const authArgs = { path: apiPath ?? "entry.cgi", maxVersion: maxVersion ?? 7, ...serviceWidget };
    const loginUrl = formatApiCall(AUTH_ENDPOINT, authArgs);

    const [status, contentType, data] = await login(loginUrl);
    if (status !== 200) {
        return [status, contentType, data];
    }

    const [retryStatus, retryContentType, retryData] = await httpProxy(url);
    return [retryStatus, retryContentType, retryData];
}

function toError(url: string, synologyError: SynologyResponse) {
    // commeon codes (100 => 199) from:
    // https://global.download.synology.com/download/Document/Software/DeveloperGuide/Os/DSM/All/enu/DSM_Login_Web_API_Guide_enu.pdf
    const nestedCode = typeof synologyError.error === "object" ? synologyError.error.code : undefined;
    const code = nestedCode ?? synologyError.error ?? synologyError.code ?? 100;
    const error: { code: number | SynologyError; error?: string } = { code };
    switch (code) {
        case 102:
            error.error = "The requested API does not exist.";
            break;

        case 103:
            error.error = "The requested method does not exist.";
            break;

        case 104:
            error.error = "The requested version does not support the functionality.";
            break;

        case 105:
            error.error = "The logged in session does not have permission.";
            break;

        case 106:
            error.error = "Session timeout.";
            break;

        case 107:
            error.error = "Session interrupted by duplicated login.";
            break;

        case 119:
            error.error = "Invalid session or SID not found.";
            break;

        default:
            error.error = synologyError.message ?? "Unknown error.";
            break;
    }
    logger.warn(`Unable to call ${url}.  code: ${code}, error: ${error.error}.`);
    return error;
}

export default async function synologyProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (!group || !service || typeof group !== "string" || typeof service !== "string") {
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const serviceWidget = await getServiceWidget(group, service, index);
    if (!serviceWidget) {
        return res.status(400).json({ error: "Invalid proxy service type" });
    }
    const widget = widgets?.[serviceWidget.type];
    const mapping = typeof endpoint === "string" ? widget?.mappings?.[endpoint] : undefined;
    if (!widget?.api || !mapping) {
        return res.status(403).json({ error: "Service does not support API calls" });
    }

    const [cgiPath, maxVersion] = await getApiInfo(serviceWidget, mapping.apiName, service);
    if (!cgiPath || !maxVersion) {
        return res.status(400).json({ error: `Unrecognized API name: ${mapping.apiName}` });
    }

    const url = formatApiCall(widget.api, {
        apiName: mapping.apiName,
        apiMethod: mapping.apiMethod,
        cgiPath,
        maxVersion,
        ...serviceWidget,
    });
    let [status, contentType, data] = await httpProxy(url);
    if (status !== 200) {
        logger.debug("Error %d calling url %s", status, url);
        if (contentType) res.setHeader("Content-Type", contentType);
        return res.status(status).send(data);
    }

    let json = asJson<SynologyResponse>(data);
    if (json?.success !== true) {
        logger.debug(`Attempting login to ${serviceWidget.type}`);
        [status, contentType, data] = await handleUnsuccessfulResponse(serviceWidget, url, service);
        json = asJson<SynologyResponse>(data);
    }

    if (json.success !== true) {
        data = toError(url, json);
        status = 500;
    }
    if (contentType) res.setHeader("Content-Type", contentType);
    return res.status(status).send(data);
}
