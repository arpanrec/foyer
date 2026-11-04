import { describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

const { getConfigErrors } = vi.hoisted(() => ({
    getConfigErrors: vi.fn(() => [] as { name: string; config: string; reason: string }[]),
}));

vi.mock("@/utils/config/store", () => ({ getConfigErrors }));

import handler from "@/app/api/validate/handler";

describe("app/api/validate/handler", () => {
    it("returns an empty list when every config member loaded", async () => {
        const res = createMockRes();
        await handler({} as ApiRequest, res as ApiResponse);
        expect(res.body).toEqual([]);
    });

    it("returns the errors recorded while loading the config members", async () => {
        getConfigErrors.mockReturnValueOnce([{ name: "SyntaxError", config: "settings", reason: "Unexpected token" }]);

        const res = createMockRes();
        await handler({} as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual([{ name: "SyntaxError", config: "settings", reason: "Unexpected token" }]);
    });

    it("leaves out widgets errors, which do not stop the dashboard from rendering", async () => {
        getConfigErrors.mockReturnValueOnce([
            { name: "Error", config: "widgets", reason: "boom" },
            { name: "Error", config: "docker", reason: "bad" },
        ]);

        const res = createMockRes();
        await handler({} as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual([{ name: "Error", config: "docker", reason: "bad" }]);
    });
});
