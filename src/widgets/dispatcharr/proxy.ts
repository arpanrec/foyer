import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, dropSession } from "@/utils/proxy/session";
import type { DispatcharrListing, DispatcharrToken } from "@/widgets/dispatcharr/types";
import widgets from "@/widgets/widgets";

const proxyName = "dispatcharrProxyHandler";
const tokenCacheKey = `${proxyName}__token`;
const logger = createLogger(proxyName);

async function login(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined
): Promise<[number, string | null | undefined]> {
    const authResponse = await httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    const status = authResponse[0];
    let data: unknown = authResponse[2];
    let tokens: DispatcharrToken;
    try {
        tokens = JSON.parse(Buffer.from(authResponse[2] as Uint8Array).toString()) as DispatcharrToken;
        data = tokens;

        if (status !== 200) {
            throw new Error(`HTTP ${status} logging into dispatcharr`);
        }
    } catch (e) {
        logger.error(`Error ${status} logging into dispatcharr`, JSON.stringify(data));
        return [status, null];
    }
    return [status, tokens.access];
}

// The cached token, or a new one from a login. A cached token has no login of its own, so it answers 200. A call that
// joined another request's login gets no outcome of its own: it has the token if that login worked and a 401 if not.
async function authenticate(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined,
    service: string
): Promise<[number, string | null | undefined]> {
    let outcome: [number, string | null | undefined] | undefined;
    const token = await cachedSession<string>(`${tokenCacheKey}.${service}`, async () => {
        outcome = await login(loginUrl, username, password);
        return outcome[1] ? { value: outcome[1] } : undefined;
    });
    return outcome ?? (token ? [200, token] : [401, null]);
}

export default async function dispatcharrProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (group && typeof service === "string") {
        const widget = await getServiceWidget(group, service, index);

        if (!widget || !widgets[widget.type]?.api) {
            logger.warn("Service does not support API calls for service '%s' in group '%s'", service, group);
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        if (widget) {
            const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));
            const loginUrl = formatApiCall(widgets[widget.type]!.api, {
                endpoint: widgets[widget.type]!.mappings?.["token"]?.endpoint,
                ...widget,
            });

            let status;
            let data;

            let token: string | null | undefined;
            [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);
            if (!token) {
                logger.debug(`HTTP ${status} logging into Dispatcharr}`);
                return res.status(status).send({ error: "Failed to authenticate with Dispatcharr" });
            }

            [status, , data] = await httpProxy(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            const badRequest = [400, 401, 403].includes(status);
            let isEmpty = false;

            try {
                const json = JSON.parse((data as Buffer).toString("utf-8")) as DispatcharrListing;
                isEmpty = Array.isArray(json.items) && json.items.length === 0;
            } catch (err) {
                logger.error("Failed to parse Dispatcharr response JSON:", err);
            }

            if (badRequest || isEmpty) {
                if (badRequest) {
                    logger.debug(`HTTP ${status} retrieving data from Dispatcharr, logging in and trying again.`);
                } else {
                    logger.debug(`Received empty list from Dispatcharr, logging in and trying again.`);
                }
                await dropSession(`${tokenCacheKey}.${service}`);
                [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);

                if (status !== 200) {
                    logger.debug(`HTTP ${status} logging into Dispatcharr: ${JSON.stringify(data)}`);
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
