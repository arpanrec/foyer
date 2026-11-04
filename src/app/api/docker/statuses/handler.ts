import { firstQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getDockerStatuses } from "@/utils/docker/status";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("dockerStatuses");

async function handler(req: ApiRequest, res: ApiResponse) {
    const server = firstQueryValue(req.query["server"]) ?? "";
    try {
        const result = await getDockerStatuses(server);

        if (result.error) {
            return res.status(500).send({ error: result.error });
        }

        return res.status(200).json(result);
    } catch (e) {
        logger.error("Error getting Docker statuses from server '%s': %s", server, errorMessage(e) ?? String(e));
        return res.status(500).send({
            error: { message: errorMessage(e) ?? "Unknown error" },
        });
    }
}

export default withAuth(handler);
