import mc from "minecraftstatuspinger";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";

const proxyName = "minecraftProxyHandler";
const logger = createLogger(proxyName);

export default async function minecraftProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget(group, service, index);
    if (!serviceWidget?.url) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }
    const url = new URL(serviceWidget.url);
    try {
        const pingResponse = await mc.lookup({
            host: url.hostname,
            // the library accepts the port string from the URL, its types only list numbers
            port: (url.port || 25565) as number,
        });
        if (!pingResponse.status) {
            throw new Error("Server returned no status");
        }
        res.status(200).send({
            version: pingResponse.status.version.name,
            online: true,
            players: pingResponse.status.players,
        });
    } catch (e) {
        if (e) logger.error(e);
        res.status(200).send({
            version: undefined,
            online: false,
            players: undefined,
        });
    }
}
