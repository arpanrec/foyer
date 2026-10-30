import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { servicesResponse } from "@/utils/config/api-response";

async function handler(req: ApiRequest, res: ApiResponse) {
    res.send(await servicesResponse());
}

export default withAuth(handler);
