import { GameDig, type QueryOptions } from "gamedig";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import type { GamedigOptions } from "@/widgets/gamedig/types";

const proxyName = "gamedigProxyHandler";
const logger = createLogger(proxyName);

export default async function gamedigProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget<GamedigOptions>(group, service, index);
    if (!serviceWidget?.url) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return res.status(400).json({ error: "Invalid proxy service type" });
    }
    const url = new URL(serviceWidget.url);

    try {
        const gamedigOptions: QueryOptions = {
            type: serviceWidget.serverType ?? "",
            host: url.hostname,
            port: Number(url.port) || undefined,
            givenPortOnly: true,
            checkOldIDs: true,
        };

        if (serviceWidget.gameToken) {
            gamedigOptions.token = serviceWidget.gameToken;
        }

        const serverData = await GameDig.query(gamedigOptions);

        res.status(200).send({
            online: true,
            name: serverData.name,
            map: serverData.map,
            players: serverData.numplayers ?? serverData.players?.length,
            maxplayers: serverData.maxplayers,
            bots: serverData.bots.length,
            ping: serverData.ping,
        });
    } catch (e) {
        if (e) logger.error(e);

        res.status(200).send({
            online: false,
        });
    }
}
