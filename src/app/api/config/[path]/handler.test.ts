import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getCustomFile } = vi.hoisted(() => ({
    getCustomFile: vi.fn(),
}));

vi.mock("@/utils/config/store", () => ({
    CUSTOM_FILES: ["custom.css", "custom.js"],
    getCustomFile,
}));

import handler from "@/app/api/config/[path]/handler";

describe("app/api/config/[path]/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 422 for unsupported files", async () => {
        const req = { query: { path: "not-supported.txt" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.statusCode).toBe(422);
        expect(getCustomFile).not.toHaveBeenCalled();
    });

    it("serves customCss as text/css", async () => {
        getCustomFile.mockReturnValueOnce("body{}");

        const req = { query: { path: "custom.css" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(getCustomFile).toHaveBeenCalledWith("custom.css");
        expect(res.headers["Content-Type"]).toBe("text/css");
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe("body{}");
    });

    it("serves customJs as text/javascript, empty when the config has none", async () => {
        getCustomFile.mockReturnValueOnce("");

        const req = { query: { path: "custom.js" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.headers["Content-Type"]).toBe("text/javascript");
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe("");
    });
});
