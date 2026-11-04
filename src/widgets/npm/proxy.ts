import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { cachedSession, dropSession } from "@/utils/proxy/session";
import type { NpmTokenReply } from "@/widgets/npm/types";
import widgets from "@/widgets/widgets";

const proxyName = "npmProxyHandler";
const tokenCacheKey = `${proxyName}__token`;
const logger = createLogger(proxyName);

async function login(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined
): Promise<[number, string | NpmTokenReply, (number | undefined)?]> {
    const authResponse = await httpProxy(loginUrl, {
        method: "POST",
        body: JSON.stringify({ identity: username, secret: password }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    const status = authResponse[0];
    // stays the raw body when it is not JSON
    let data = authResponse[2] as NpmTokenReply;
    let ttlMs: number | undefined;

    try {
        data = JSON.parse(Buffer.from(authResponse[2] as Uint8Array).toString());

        if (status === 200) {
            const expiration = new Date(data.expires).getTime() - Date.now();
            ttlMs = expiration - 5 * 60 * 1000; // expiration -5 minutes
        }
    } catch (e) {
        logger.error(`Error ${status} logging into npm`, JSON.stringify(authResponse[2]));
    }
    return [status, data.token ?? data, ttlMs];
}

// The cached token, or a new one from a login. A cached token has no login of its own, so it answers 200. A call that
// joined another request's login gets no outcome of its own: it has the token if that login worked and a 401 if not.
async function authenticate(
    loginUrl: string,
    username: string | undefined,
    password: string | undefined,
    service: string | string[]
): Promise<[number, string | NpmTokenReply]> {
    let outcome: [number, string | NpmTokenReply, (number | undefined)?] | undefined;
    const token = await cachedSession<string>(`${tokenCacheKey}.${service}`, async () => {
        outcome = await login(loginUrl, username, password);
        const [status, body, ttlMs] = outcome;
        return status === 200 && typeof body === "string" ? { value: body, ttlMs } : undefined;
    });
    if (outcome) return [outcome[0], outcome[1]];
    return token ? [200, token] : [401, ""];
}

export default async function npmProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (group && service) {
        const widget = await getServiceWidget(group, service, index);

        if (!widget || !widgets[widget.type]?.api) {
            logger.warn("Service does not support API calls for service '%s' in group '%s'", service, group);
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        if (widget) {
            const url = new URL(formatApiCall(widgets[widget.type]!.api, { endpoint, ...widget }));
            const loginUrl = `${widget.url}/api/tokens`;

            let status;
            let data;

            let token: string | NpmTokenReply;
            [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);
            if (status !== 200) {
                logger.debug(`HTTP ${status} logging into npm api: ${token}`);
                return res.status(status).send(token);
            }

            [status, , data] = await httpProxy(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (status === 403) {
                logger.debug(`HTTP ${status} retrieving data from npm api, logging in and trying again.`);
                await dropSession(`${tokenCacheKey}.${service}`);
                [status, token] = await authenticate(loginUrl, widget.username, widget.password, service);

                if (status !== 200) {
                    logger.debug(`HTTP ${status} logging into npm api: ${data}`);
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
