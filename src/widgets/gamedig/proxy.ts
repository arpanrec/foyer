import { GameDig, type QueryOptions } from "gamedig";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import type { GamedigOptions } from "@/widgets/gamedig/types";

const proxyName = "gamedigProxyHandler";
const logger = createLogger(proxyName);

export default async function gamedigProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget<GamedigOptions>(group, service, index);
    if (!serviceWidget?.url) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }
    const url = new URL(serviceWidget.url);

    try {
        const gamedigOptions: QueryOptions = {
            type: serviceWidget.serverType ?? "",
            host: url.hostname,
            ...(Number(url.port) ? { port: Number(url.port) } : {}),
            givenPortOnly: true,
            checkOldIDs: true,
        };

        if (serviceWidget.gameToken) {
            gamedigOptions.token = serviceWidget.gameToken;
        }

        const serverData = await GameDig.query(gamedigOptions);

        return res.status(200).send({
            online: true,
            name: serverData.name,
            map: serverData.map,
            players: serverData.numplayers ?? serverData.players?.length,
            maxplayers: serverData.maxplayers,
            bots: serverData.bots.length,
            ping: serverData.ping,
        });
    } catch (e) {
        logger.error(
            "Error getting data from the game server for service '%s' in group '%s': %s",
            service,
            group,
            errorMessage(e) ?? String(e)
        );

        return res.status(200).send({
            online: false,
        });
    }
}
