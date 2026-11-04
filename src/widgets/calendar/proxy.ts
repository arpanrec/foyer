import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { httpProxy, type HttpProxyParams } from "@/utils/proxy/http";
import { foyerUserAgent } from "@/utils/proxy/user-agent";
import type { CalendarOptions } from "@/widgets/calendar/types";

const logger = createLogger("calendarProxyHandler");

export default async function calendarProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, endpoint, index } = req.query;

    if (group && service) {
        const widget = await getServiceWidget<CalendarOptions>(group, service, index);
        const integration = widget?.integrations?.find((i) => i.name === endpoint);

        if (integration) {
            if (!integration.url) {
                logger.warn("No integration URL specified for service '%s' in group '%s'", service, group);
                return res.status(403).json({ error: "No integration URL specified" });
            }

            const options: HttpProxyParams = {};
            if (integration.url?.includes("outlook")) {
                // Outlook requires a user agent header
                options.headers = {
                    "User-Agent": foyerUserAgent(integration.url),
                };
            }
            const [status, contentType, data] = await httpProxy(integration.url, options);

            if (contentType) res.setHeader("Content-Type", contentType);

            if (status !== 200) {
                logger.debug(`HTTP ${status} retrieving data from integration URL ${integration.url} : ${data}`);
                return res.status(status).send(data);
            }

            return res.status(status).json({ data: Buffer.isBuffer(data) ? data.toString() : String(data) });
        }
    }

    logger.warn("Invalid integration for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid integration" });
}
