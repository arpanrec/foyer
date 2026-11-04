import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getRemoteImage, isImageUrlAllowed, isPublicOnlyImageUrl } = vi.hoisted(() => ({
    isPublicOnlyImageUrl: vi.fn(() => false),
    getRemoteImage: vi.fn(),
    isImageUrlAllowed: vi.fn(),
}));
const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/icons", () => ({ DEFAULT_MAX_AGE_SECONDS: 86400, getRemoteImage }));
vi.mock("@/utils/image-allowlist", () => ({ isImageUrlAllowed, isPublicOnlyImageUrl }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

import handler from "@/app/api/icon-proxy/handler";

describe("app/api/icon-proxy/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isImageUrlAllowed.mockReturnValue(true);
        isPublicOnlyImageUrl.mockReturnValue(false);
    });

    it("refuses an address Foyer did not hand out, without fetching it", async () => {
        isImageUrlAllowed.mockReturnValue(false);

        const res = createMockRes();
        await handler({ query: { url: "http://192.168.1.10/admin" } }, res as ApiResponse);

        expect(res.statusCode).toBe(403);
        expect(getRemoteImage).not.toHaveBeenCalled();
    });

    it("sends the fetched image", async () => {
        const body = Buffer.from([1, 2, 3]);
        getRemoteImage.mockResolvedValue({ body, contentType: "image/png" });

        const res = createMockRes();
        await handler({ query: { url: "http://nas.lan/logo.png" } }, res as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("http://nas.lan/logo.png", undefined, false);
        expect(res.headers["Content-Type"]).toBe("image/png");
        expect(res.body).toEqual(body);
    });

    it("fetches an address from third-party content only from public hosts", async () => {
        isPublicOnlyImageUrl.mockReturnValue(true);
        getRemoteImage.mockResolvedValue({ body: Buffer.from([1]), contentType: "image/png" });

        const res = createMockRes();
        await handler({ query: { url: "https://feed.example/a.png" } }, res as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("https://feed.example/a.png", undefined, true);
    });

    it("passes a requested maxAge on, capped at one day, and sends it as the browser cache time", async () => {
        getRemoteImage.mockResolvedValue({ body: Buffer.from([1]), contentType: "image/jpeg" });

        const res = createMockRes();
        await handler({ query: { url: "http://nas.lan/p.jpg", maxAge: "120" } }, res as ApiResponse);
        expect(getRemoteImage).toHaveBeenCalledWith("http://nas.lan/p.jpg", 120, false);
        expect(res.headers["Cache-Control"]).toBe("private, max-age=120");

        await handler({ query: { url: "http://nas.lan/p.jpg", maxAge: "999999999" } }, createMockRes() as ApiResponse);
        expect(getRemoteImage).toHaveBeenLastCalledWith("http://nas.lan/p.jpg", 86400, false);

        await handler({ query: { url: "http://nas.lan/p.jpg", maxAge: "nope" } }, createMockRes() as ApiResponse);
        expect(getRemoteImage).toHaveBeenLastCalledWith("http://nas.lan/p.jpg", undefined, false);
    });

    it("answers 400 and logs a warning without a url", async () => {
        const res = createMockRes();
        await handler({ query: {} }, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(logger.warn).toHaveBeenCalled();
        expect(getRemoteImage).not.toHaveBeenCalled();
    });

    it("answers 404 when the image cannot be fetched", async () => {
        getRemoteImage.mockResolvedValue(undefined);

        const res = createMockRes();
        await handler({ query: { url: "http://nas.lan/x.png" } }, res as ApiResponse);

        expect(res.statusCode).toBe(404);
    });
});
