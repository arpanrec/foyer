import cache from "memory-cache";

import { bookmarksResponse, servicesResponse, widgetsResponse } from "@/utils/config/api-response";
import { getSettings } from "@/utils/config/config";
import createLogger from "@/utils/logger";

const cacheKey = "foyerDashboardData";

export function invalidateDashboardData() {
    cache.del(cacheKey);
}

async function loadDashboardData() {
    const { providers: _providers, ...settings } = getSettings();
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
    let pending = cache.get(cacheKey);
    if (!pending) {
        pending = loadDashboardData().catch((error) => {
            if (cache.get(cacheKey) === pending) invalidateDashboardData();
            throw error;
        });
        cache.put(cacheKey, pending);
    }
    try {
        return await pending;
    } catch (error) {
        createLogger("index").error(error);
        return {
            initialSettings: {},
            fallback: { "/api/services": [], "/api/bookmarks": [], "/api/widgets": [], "/api/hash": false },
        };
    }
}
