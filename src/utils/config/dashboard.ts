import cache from "@/utils/cache";
import { bookmarksResponse, servicesResponse, widgetsResponse } from "@/utils/config/api-response";
import { getSettings } from "@/utils/config/settings";
import { getConfigErrors } from "@/utils/config/store";
import createLogger from "@/utils/logger";

const cacheKey = "foyerDashboardData";

export async function invalidateDashboardData() {
    await cache.del(cacheKey, "dashboard");
}

async function loadDashboardData() {
    const { providers: _providers, ...settings } = await getSettings();
    const [services, bookmarks, widgets] = await Promise.all([
        servicesResponse(),
        bookmarksResponse(),
        widgetsResponse(),
    ]);
    return {
        initialSettings: settings,
        fallback: {
            "/api/services": services,
            "/api/bookmarks": bookmarks,
            "/api/widgets": widgets,
            "/api/hash": false,
        },
    };
}

export async function getDashboardData() {
    try {
        // A config that did not load cleanly is not stored, so neither is the dashboard built from it: the next
        // request builds it again from the file
        if ((await getConfigErrors()).length > 0) return await loadDashboardData();
        // Concurrent requests share one load, and a load that fails is not kept
        return (await cache.getOrFetch(cacheKey, loadDashboardData, { type: "dashboard" })) as Awaited<
            ReturnType<typeof loadDashboardData>
        >;
    } catch (error) {
        createLogger("index").error(error);
        return {
            initialSettings: {},
            fallback: { "/api/services": [], "/api/bookmarks": [], "/api/widgets": [], "/api/hash": false },
        };
    }
}
