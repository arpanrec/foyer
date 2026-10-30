import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePageAuth, getDashboardData } = vi.hoisted(() => ({
    requirePageAuth: vi.fn(),
    getDashboardData: vi.fn(),
}));

vi.mock("@/utils/app-auth", () => ({ requirePageAuth }));
vi.mock("@/utils/config/dashboard", () => ({ getDashboardData }));
vi.mock("@/app/dashboard", () => ({ default: () => null }));

import Dashboard from "@/app/dashboard";
import Page from "@/app/page";

describe("app/page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDashboardData.mockResolvedValue({
            initialSettings: { title: "Foyer" },
            fallback: { "/api/services": [{ name: "svc" }] },
        });
    });

    it("checks auth with the request query before loading dashboard data", async () => {
        const element = await Page({ searchParams: Promise.resolve({ tab: "private" }) });

        expect(requirePageAuth).toHaveBeenCalledWith("/", { tab: "private" });
        expect(requirePageAuth.mock.invocationCallOrder[0]).toBeLessThan(getDashboardData.mock.invocationCallOrder[0]);
        expect(element.type).toBe(Dashboard);
        expect(element.props).toEqual({
            initialSettings: { title: "Foyer" },
            fallback: { "/api/services": [{ name: "svc" }] },
        });
    });

    it("does not load dashboard data when auth stops the request", async () => {
        requirePageAuth.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

        await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
        expect(getDashboardData).not.toHaveBeenCalled();
    });
});
