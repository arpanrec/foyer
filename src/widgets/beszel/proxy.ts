import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, dropSession } from "@/utils/proxy/session";
import type { BeszelAuthReply } from "@/widgets/beszel/types";
import widgets from "@/widgets/widgets";

const proxyName = "beszelProxyHandler";
const tokenCacheKey = `${proxyName}__token`;
const logger = createLogger(proxyName);

async function login(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined
): Promise<[number, unknown]> {
    const authResponse = await httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify({ identity: username, password }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    const status = authResponse[0];
    let data: unknown = authResponse[2];
    let token: string | undefined;
    try {
        const parsed = JSON.parse(Buffer.from(authResponse[2] as Uint8Array).toString()) as BeszelAuthReply;
        data = parsed;
        token = parsed.token;
    } catch (e) {
        logger.error(`Error ${status} logging into beszel`, JSON.stringify(authResponse[2]));
    }
    return [status, token ?? data];
}

// The cached token, or a new one from a login. A cached token has no login of its own, so it answers 200. A call that
// joined another request's login gets no outcome of its own: it has the token if that login worked and a 401 if not.
async function authenticate(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined,
    service: string | string[]
): Promise<[number, unknown]> {
    let outcome: [number, unknown] | undefined;
    const token = await cachedSession<string>(`${tokenCacheKey}.${service}`, async () => {
        outcome = await login(loginUrl, username, password);
        return outcome[0] === 200 && typeof outcome[1] === "string" ? { value: outcome[1] } : undefined;
    });
    return outcome ?? (token ? [200, token] : [401, { error: "Failed to authenticate with Beszel" }]);
}

export default async function beszelProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (group && service) {
        const widget = await getServiceWidget(group, service, index);

        if (!widget || !widgets[widget.type]?.api) {
            logger.warn("Service does not support API calls for service '%s' in group '%s'", service, group);
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        if (widget) {
            const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));
            let authEndpointVersion = "authv1";
            if (widget["version"] === 2) authEndpointVersion = "authv2";
            const loginUrl = formatApiCall(widgets[widget.type]!.api, {
                endpoint: widgets[widget.type]!.mappings?.[authEndpointVersion]?.endpoint,
                ...widget,
            });

            let status: number;
            let data: unknown;

            let token: unknown;
            [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);
            if (status !== 200) {
                logger.debug(`HTTP ${status} logging into Beszel: ${JSON.stringify(token)}`);
                return res.status(status).send(token);
            }

            [status, , data] = await httpProxy(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            const badRequest = [400, 403].includes(status);
            const text = Buffer.isBuffer(data) ? data.toString("utf-8") : String(data);
            let isEmpty = false;

            try {
                const json = JSON.parse(text);
                isEmpty = Array.isArray(json.items) && json.items.length === 0;
            } catch (err) {
                logger.debug("Failed to parse Beszel response JSON:", err);
            }

            if (badRequest || isEmpty) {
                if (badRequest) {
                    logger.debug(`HTTP ${status} retrieving data from Beszel, logging in and trying again.`);
                } else {
                    logger.debug(`Received empty list from Beszel, logging in and trying again.`);
                }
                await dropSession(`${tokenCacheKey}.${service}`);
                [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);

                if (status !== 200) {
                    logger.debug(`HTTP ${status} logging into Beszel: ${JSON.stringify(data)}`);
                    return res.status(status).send(data);
                }

                [status, , data] = await httpProxy(url, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });
            }

            if (status !== 200) {
                return res.status(status).send(data);
            }

            return res.send(data);
        }
    }

    logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
}
