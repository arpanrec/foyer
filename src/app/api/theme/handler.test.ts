import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

const { checkAndCopyConfig, getSettings } = vi.hoisted(() => ({
    checkAndCopyConfig: vi.fn(),
    getSettings: vi.fn(),
}));

vi.mock("@/utils/config/config", () => ({
    default: checkAndCopyConfig,
    getSettings,
}));

import handler from "@/app/api/theme/handler";

describe("app/api/theme/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns defaults when settings are missing", async () => {
        getSettings.mockReturnValueOnce({});

        const res = createMockRes();
        await handler({} as ApiRequest, res as ApiResponse);

        expect(checkAndCopyConfig).toHaveBeenCalledWith("settings.yaml");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ color: "slate", theme: "dark" });
    });

    it("returns configured color + theme when present", async () => {
        getSettings.mockReturnValueOnce({ color: "red", theme: "light" });

        const res = createMockRes();
        await handler({} as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual({ color: "red", theme: "light" });
    });
});
