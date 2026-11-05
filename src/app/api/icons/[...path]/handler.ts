import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { requestsNoCache } from "@/utils/cache-control";
import { sendIcon } from "@/utils/icon-response";
import { getIcon } from "@/utils/icons";

async function handler(req: ApiRequest, res: ApiResponse) {
    const { path } = req.query;
    const segments = Array.isArray(path) ? path : path ? [path] : [];

    const icon = await getIcon(segments, requestsNoCache(req.headers));
    if (!icon) return res.status(404).send({ error: "Icon not found" });

    return sendIcon(res, icon);
}

export default withAuth(handler);
