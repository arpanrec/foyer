import { beforeEach, describe, expect, it, vi } from "vitest";

const { services, bookmarks, widgets, settings, configErrors, logger } = vi.hoisted(() => ({
    configErrors: vi.fn(),
    services: vi.fn(),
    bookmarks: vi.fn(),
    widgets: vi.fn(),
    settings: vi.fn(),
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/utils/config/api-response", () => ({
    servicesResponse: services,
    bookmarksResponse: bookmarks,
    widgetsResponse: widgets,
}));
vi.mock("@/utils/config/settings", () => ({ getSettings: settings }));
vi.mock("@/utils/config/store", () => ({ getConfigErrors: configErrors }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

import { getDashboardData, invalidateDashboardData } from "@/utils/config/dashboard";

describe("dashboard data snapshot", () => {
    beforeEach(async () => {
        vi.resetAllMocks();
        await invalidateDashboardData();
        services.mockResolvedValue([{ name: "private service" }]);
        bookmarks.mockResolvedValue([]);
        widgets.mockResolvedValue([]);
        settings.mockReturnValue({ providers: { privateKey: "secret" }, title: "Dashboard" });
        configErrors.mockResolvedValue([]);
    });

    it("builds the dashboard on every request while the config has errors, and keeps it once the config loads", async () => {
        configErrors.mockResolvedValue([{ config: "file", name: "Error", reason: "template not found" }]);

        await getDashboardData();
        await getDashboardData();
        expect(services).toHaveBeenCalledTimes(2);

        configErrors.mockResolvedValue([]);
        await getDashboardData();
        await getDashboardData();
        expect(services).toHaveBeenCalledTimes(3);
    });

    it("coalesces concurrent discovery and reuses the snapshot for later page loads", async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => getDashboardData()));
        const later = await getDashboardData();
        for (const loader of [services, bookmarks, widgets, settings]) expect(loader).toHaveBeenCalledOnce();
        expect(results.every((result) => result === later)).toBe(true);
        expect(later.initialSettings).toEqual({ title: "Dashboard" });
        expect(later.fallback["/api/services"]).toEqual([{ name: "private service" }]);
    });

    it("refreshes configuration and discovery after invalidation", async () => {
        await getDashboardData();
        await invalidateDashboardData();
        settings.mockReturnValue({ title: "Updated" });
        const result = await getDashboardData();
        expect(services).toHaveBeenCalledTimes(2);
        expect(result.initialSettings.title).toBe("Updated");
    });

    it("retries after a failed load instead of caching an empty dashboard", async () => {
        services.mockRejectedValueOnce(new Error("discovery failed"));
        expect((await getDashboardData()).fallback["/api/services"]).toEqual([]);
        expect((await getDashboardData()).fallback["/api/services"]).toEqual([{ name: "private service" }]);
        expect(services).toHaveBeenCalledTimes(2);
    });

    it("does not let a stale failed load evict a newer snapshot", async () => {
        let reject: (error: Error) => void = () => {};
        services.mockImplementationOnce(
            () =>
                new Promise((_resolve, fail) => {
                    reject = fail;
                })
        );
        const stale = getDashboardData();
        // the load starts once the config errors have been read
        await vi.waitFor(() => expect(services).toHaveBeenCalledOnce());
        await invalidateDashboardData();
        const current = await getDashboardData();
        reject(new Error("old discovery failed"));
        await stale;
        expect(await getDashboardData()).toBe(current);
        expect(services).toHaveBeenCalledTimes(2);
    });
});
