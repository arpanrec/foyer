import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { invalidateDashboardData } from "@/utils/config/dashboard";

async function handler(_req: ApiRequest, res: ApiResponse) {
    await invalidateDashboardData();
    return res.json({ revalidated: true });
}

export default withAuth(handler);
