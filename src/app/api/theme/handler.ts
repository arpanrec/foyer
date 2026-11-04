import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/settings";

async function handler(_req: ApiRequest, res: ApiResponse) {
    const settings = await getSettings();

    const color = settings.color || "slate";
    const theme = settings.theme || "dark";

    return res.status(200).json({
        color,
        theme,
    });
}

export default withAuth(handler);
