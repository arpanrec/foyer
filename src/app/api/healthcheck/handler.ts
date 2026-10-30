import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAllowedHost } from "@/utils/auth";

function handler(req: ApiRequest, res: ApiResponse) {
    res.send("up");
}

export default withAllowedHost(handler);
