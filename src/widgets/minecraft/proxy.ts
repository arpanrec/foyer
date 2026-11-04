import { GameDig } from "gamedig";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const proxyName = "minecraftProxyHandler";
const logger = createLogger(proxyName);

export default async function minecraftProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget(group, service, index);
    if (!serviceWidget?.url) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }
    const url = new URL(serviceWidget.url);
    try {
        const serverData = await GameDig.query({
            type: "minecraft",
            host: url.hostname,
            // without a port in the url, gamedig uses the Minecraft default of 25565
            ...(Number(url.port) ? { port: Number(url.port) } : {}),
            givenPortOnly: true,
            // one attempt, which gives up after ten seconds
            maxRetries: 1,
            attemptTimeout: 10000,
        });
        return res.status(200).send({
            version: serverData.version,
            online: true,
            players: { online: serverData.numplayers, max: serverData.maxplayers },
        });
    } catch (e) {
        logger.error(
            "Error getting data from the Minecraft server for service '%s' in group '%s': %s",
            service,
            group,
            errorMessage(e) ?? String(e)
        );
        return res.status(200).send({
            version: undefined,
            online: false,
            players: undefined,
        });
    }
}
