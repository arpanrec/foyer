import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getIcon } = vi.hoisted(() => ({ getIcon: vi.fn() }));

vi.mock("@/utils/icons", () => ({ DEFAULT_MAX_AGE_SECONDS: 86400, getIcon }));

import handler from "@/app/api/icons/[...path]/handler";

describe("app/api/icons/[...path]/handler", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends the icon with its content type and a restrictive CSP", async () => {
        getIcon.mockResolvedValue({ body: Buffer.from("<svg/>"), contentType: "image/svg+xml" });

        const res = createMockRes();
        await handler({ query: { path: ["mdi", "home.svg"] } }, res as ApiResponse);

        expect(getIcon).toHaveBeenCalledWith(["mdi", "home.svg"]);
        expect(res.headers["Content-Type"]).toBe("image/svg+xml");
        expect(res.headers["Content-Security-Policy"]).toContain("sandbox");
        expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(res.body).toEqual(Buffer.from("<svg/>"));
    });

    it("answers 404 when the icon does not exist", async () => {
        getIcon.mockResolvedValue(undefined);

        const res = createMockRes();
        await handler({ query: { path: ["mdi", "nope.svg"] } }, res as ApiResponse);

        expect(res.statusCode).toBe(404);
    });

    it("passes a single path segment as a one-item list", async () => {
        getIcon.mockResolvedValue(undefined);

        const res = createMockRes();
        await handler({ query: { path: "favicon.svg" } }, res as ApiResponse);

        expect(getIcon).toHaveBeenCalledWith(["favicon.svg"]);
        expect(res.statusCode).toBe(404);
    });

    it("answers 404 without a path", async () => {
        getIcon.mockResolvedValue(undefined);

        const res = createMockRes();
        await handler({ query: {} }, res as ApiResponse);

        expect(getIcon).toHaveBeenCalledWith([]);
        expect(res.statusCode).toBe(404);
    });
});
