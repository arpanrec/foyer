import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

const { checkAndCopyConfig, getSettings } = vi.hoisted(() => ({
    checkAndCopyConfig: vi.fn(),
    getSettings: vi.fn(() => ({})),
}));

vi.mock("@/utils/config/config", () => ({
    default: checkAndCopyConfig,
    getSettings,
    CONF_DIR: "/tmp",
}));

import handler from "@/app/api/validate/handler";

describe("app/api/validate/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns errors for any configs that don't validate", async () => {
        checkAndCopyConfig
            .mockReturnValueOnce(true)
            .mockReturnValueOnce({
                name: "YAMLException",
                config: "settings.yaml",
                reason: "settings bad",
                mark: { line: 1 },
            })
            .mockReturnValue(true);

        const req = {};
        const res = createMockRes();

        await handler(req as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual([
            {
                name: "YAMLException",
                config: "settings.yaml",
                reason: "settings bad",
                mark: { line: 1 },
            },
        ]);
    });
});
