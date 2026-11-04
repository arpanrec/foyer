import { firstQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getDockerStats } from "@/utils/docker/stats";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("dockerStats");

async function handler(req: ApiRequest, res: ApiResponse) {
    const server = firstQueryValue(req.query["server"]) ?? "";
    try {
        const result = await getDockerStats(server);

        if (result.error) {
            return res.status(500).send({ error: result.error });
        }

        return res.status(200).json(result);
    } catch (e) {
        logger.error("Error getting Docker stats from server '%s': %s", server, errorMessage(e) ?? String(e));
        return res.status(500).send({
            error: { message: errorMessage(e) ?? "Unknown error" },
        });
    }
}

export default withAuth(handler);
