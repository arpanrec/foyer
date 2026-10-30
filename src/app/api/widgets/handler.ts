import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { widgetsResponse } from "@/utils/config/api-response";

async function handler(req: ApiRequest, res: ApiResponse) {
    res.send(await widgetsResponse());
}

export default withAuth(handler);
