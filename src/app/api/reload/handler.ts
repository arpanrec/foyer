import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import cache from "@/utils/cache";
import { invalidateDashboardData } from "@/utils/config/dashboard";
import { reloadConfigs } from "@/utils/config/store";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("reload");

// Reads the config file again. A config that does not load leaves the stored one untouched and answers 422 with the
// reason, so the footer button can show it.
async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        await reloadConfigs();
    } catch (e) {
        const reason = errorMessage(e) ?? String(e);
        logger.warn("Config reload refused, keeping the loaded config: %s", reason);
        return res.status(422).json({ reloaded: false, error: reason });
    }

    // Upstream answers and logins were fetched with the old widget settings, so they go too
    await Promise.all([invalidateDashboardData(), cache.clear("response"), cache.clear("session")]);
    return res.json({ reloaded: true });
}

export default withAuth(handler);
