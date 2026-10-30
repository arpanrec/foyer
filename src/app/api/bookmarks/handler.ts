import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { bookmarksResponse } from "@/utils/config/api-response";

async function handler(req: ApiRequest, res: ApiResponse) {
    res.send(await bookmarksResponse());
}

export default withAuth(handler);
