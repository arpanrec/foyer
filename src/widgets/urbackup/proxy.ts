import { UrbackupServer } from "urbackup-server-api";

import type { ApiRequest, ApiResponse } from "@/types/api";
import getServiceWidget from "@/utils/config/service-helpers";

export default async function urbackupProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query;
    const serviceWidget = await getServiceWidget(group, service, index);
    if (!serviceWidget?.url) {
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    const server = new UrbackupServer({
        url: serviceWidget.url,
        username: serviceWidget.username,
        password: serviceWidget.password,
    });

    await (async () => {
        try {
            const allClients = await server.getStatus({ includeRemoved: false });
            let diskUsage: unknown = false;
            if (serviceWidget.fields?.includes("totalUsed")) {
                diskUsage = await server.getUsage();
            }
            res.status(200).send({
                clientStatuses: allClients,
                diskUsage,
                maxDays: serviceWidget.maxDays,
            });
        } catch (error) {
            res.status(500).json({ error: "Error communicating with UrBackup server" });
        }
    })();
}
