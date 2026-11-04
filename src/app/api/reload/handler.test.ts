import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

const { reloadConfigs, invalidateDashboardData, warn, clear } = vi.hoisted(() => ({
    clear: vi.fn(),
    reloadConfigs: vi.fn(),
    invalidateDashboardData: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/utils/cache", () => ({ default: { clear } }));
vi.mock("@/utils/config/store", () => ({ reloadConfigs }));
vi.mock("@/utils/config/dashboard", () => ({ invalidateDashboardData }));
vi.mock("@/utils/logger", () => ({
    default: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}));

import handler from "@/app/api/reload/handler";

describe("app/api/reload/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reloads the config and clears the dashboard snapshot and upstream caches", async () => {
        const res = createMockRes();
        await handler({ method: "POST" } as ApiRequest, res as ApiResponse);

        expect(reloadConfigs).toHaveBeenCalledOnce();
        expect(invalidateDashboardData).toHaveBeenCalledOnce();
        expect(clear).toHaveBeenCalledWith("response");
        expect(clear).toHaveBeenCalledWith("session");
        expect(res.body).toEqual({ reloaded: true });
    });

    it("answers 422 with the reason and keeps the caches when the config is broken", async () => {
        reloadConfigs.mockImplementationOnce(() => {
            throw new Error("Unexpected token");
        });
        const res = createMockRes();
        await handler({ method: "POST" } as ApiRequest, res as ApiResponse);

        expect(res.statusCode).toBe(422);
        expect(res.body).toEqual({ reloaded: false, error: "Unexpected token" });
        expect(invalidateDashboardData).not.toHaveBeenCalled();
        expect(clear).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
    });

    it("stringifies a thrown value that is not an Error", async () => {
        reloadConfigs.mockImplementationOnce(() => {
            // oxlint-disable-next-line no-throw-literal -- the handler must cope with any thrown value
            throw "bad";
        });
        const res = createMockRes();
        await handler({ method: "POST" } as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual({ reloaded: false, error: "bad" });
    });

    it("refuses other methods", async () => {
        const res = createMockRes();
        await handler({ method: "GET" } as ApiRequest, res as ApiResponse);

        expect(res.statusCode).toBe(405);
        expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
        expect(reloadConfigs).not.toHaveBeenCalled();
    });
});
