import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetMapFn } from "@/types/widget-definition";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { asJson, formatApiCall, sanitizeErrorURL } from "@/utils/proxy/api-helpers";
import { addCookieToJar, setCookieHeader } from "@/utils/proxy/cookie-jar";
import { httpProxy } from "@/utils/proxy/http";
import type { FrigateRawEvent, FrigateRawStats } from "@/widgets/frigate/types";
import widgets from "@/widgets/widgets";

const proxyName = "frigateProxyHandler";
const logger = createLogger(proxyName);

export default async function frigateProxyHandler(req: ApiRequest, res: ApiResponse, _map?: WidgetMapFn) {
    const { group, service, endpoint, index } = req.query;

    if (group && service) {
        const widget = await getServiceWidget(group, service, index);

        if (!widget) {
            logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
            return res.status(400).json({ error: "Invalid proxy service type" });
        }

        if (!widget || !widgets[widget.type]?.api) {
            return res.status(403).json({ error: "Service does not support API calls" });
        }

        if (widget) {
            const url = formatApiCall(widgets[widget.type].api, { endpoint, ...widget });

            const params = {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            };

            let [status, , data] = await httpProxy(url, params);

            if (status === 401 && widget.username && widget.password) {
                const loginUrl = `${widget.url}/api/login`;
                logger.debug("Attempting login to Frigate at %s", loginUrl);
                const [loginStatus, , , loginResponseHeaders] = await httpProxy(loginUrl, {
                    method: "POST",
                    body: JSON.stringify({ user: widget.username, password: widget.password }),
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (loginStatus !== 200) {
                    const errorURL = new URL(loginUrl);
                    logger.error(
                        "HTTP Error %d calling %s//%s%s...",
                        loginStatus,
                        errorURL.protocol,
                        errorURL.host,
                        errorURL.pathname
                    );
                    return res.status(status).json({
                        error: {
                            message: `HTTP Error ${status} while trying to login to Frigate`,
                            url: sanitizeErrorURL(url),
                        },
                    });
                }

                addCookieToJar(url, loginResponseHeaders);
                setCookieHeader(url, params, { overwrite: true });
                // Retry original request with cookie set
                [status, , data] = await httpProxy(url, params);
            }

            if (status >= 400) {
                const errorURL = new URL(url);
                logger.error(
                    "HTTP Error %d calling %s//%s%s...",
                    status,
                    errorURL.protocol,
                    errorURL.host,
                    errorURL.pathname
                );
                return res.status(status).json({
                    error: {
                        message: `HTTP Error ${status} from Frigate`,
                        url: sanitizeErrorURL(url),
                    },
                });
            }

            const parsed = asJson(data);

            if (endpoint == "stats") {
                const stats = parsed as FrigateRawStats;
                return res.status(status).send({
                    num_cameras: stats?.cameras !== undefined ? Object.keys(stats.cameras).length : 0,
                    uptime: stats?.service?.uptime,
                    version: stats?.service?.version,
                });
            } else if (endpoint == "events") {
                const events = parsed as FrigateRawEvent[];
                return res.status(status).send(
                    events.slice(0, 5).map((event) => ({
                        id: event.id,
                        camera: event.camera,
                        label: event.label,
                        start_time: new Date(event.start_time * 1000),
                        thumbnail: event.thumbnail,
                        score: event.data.score,
                        type: event.data.type,
                    }))
                );
            }
        }
    }

    logger.debug("Invalid or missing proxy service type '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
}
