import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getRemoteImage, getSettings } = vi.hoisted(() => ({ getRemoteImage: vi.fn(), getSettings: vi.fn() }));
const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/icons", () => ({ DEFAULT_MAX_AGE_SECONDS: 86400, getRemoteImage }));
vi.mock("@/utils/config/settings", () => ({ getSettings }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

import handler from "@/app/api/background/handler";

describe("app/api/background/handler", () => {
    beforeEach(() => vi.clearAllMocks());

    it("serves a background given as a URL string", async () => {
        const body = Buffer.from([1]);
        getSettings.mockReturnValue({ background: "https://example.com/bg.jpg" });
        getRemoteImage.mockResolvedValue({ body, contentType: "image/jpeg" });

        const res = createMockRes();
        await handler({ query: {} }, res as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("https://example.com/bg.jpg", undefined, false, false);
        expect(res.headers["Content-Type"]).toBe("image/jpeg");
        expect(res.body).toEqual(body);
    });

    it("serves a protocol-relative background over https", async () => {
        getSettings.mockReturnValue({ background: "//cdn.example.com/bg.jpg" });
        getRemoteImage.mockResolvedValue({ body: Buffer.from([1]), contentType: "image/jpeg" });

        await handler({ query: {} }, createMockRes() as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("https://cdn.example.com/bg.jpg", undefined, false, false);
    });

    it("serves the image of a background object and ignores any request URL", async () => {
        getSettings.mockReturnValue({ background: { image: "http://nas.lan/bg.png" } });
        getRemoteImage.mockResolvedValue({ body: Buffer.from([1]), contentType: "image/png" });

        const res = createMockRes();
        await handler({ query: { url: "http://evil.example/x" } }, res as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("http://nas.lan/bg.png", undefined, false, false);
    });

    it("downloads the background again for a request with Cache-Control: no-cache", async () => {
        getSettings.mockReturnValue({ background: "https://example.com/bg.jpg" });
        getRemoteImage.mockResolvedValue({ body: Buffer.from([1]), contentType: "image/jpeg" });

        await handler({ query: {}, headers: { "cache-control": "no-cache" } }, createMockRes() as ApiResponse);

        expect(getRemoteImage).toHaveBeenCalledWith("https://example.com/bg.jpg", undefined, false, true);
    });

    it("answers 404 for a relative or missing background", async () => {
        getSettings.mockReturnValue({ background: "/images/bg.jpg" });
        const relative = createMockRes();
        await handler({ query: {} }, relative as ApiResponse);
        expect(relative.statusCode).toBe(404);

        getSettings.mockReturnValue({});
        const missing = createMockRes();
        await handler({ query: {} }, missing as ApiResponse);
        expect(missing.statusCode).toBe(404);
        expect(getRemoteImage).not.toHaveBeenCalled();
    });

    it("answers 404 and warns when the image cannot be fetched", async () => {
        getSettings.mockReturnValue({ background: "https://example.com/bg.jpg" });
        getRemoteImage.mockResolvedValue(undefined);

        const res = createMockRes();
        await handler({ query: {} }, res as ApiResponse);

        expect(res.statusCode).toBe(404);
        expect(logger.warn).toHaveBeenCalled();
    });
});
