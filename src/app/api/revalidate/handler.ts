import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { invalidateDashboardData } from "@/utils/config/dashboard";

async function handler(req: ApiRequest, res: ApiResponse) {
    invalidateDashboardData();
    return res.json({ revalidated: true });
}

export default withAuth(handler);
