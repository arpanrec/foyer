import { describe, expect, it } from "vitest";

import { absoluteImageUrl, backgroundImageUrl, proxiedImageUrl } from "@/utils/image-url";

describe("utils/image-url", () => {
    it("sends full URLs through the icon proxy", () => {
        expect(proxiedImageUrl("https://example.com/a b.png")).toBe(
            `/api/icon-proxy?url=${encodeURIComponent("https://example.com/a b.png")}`
        );
        expect(proxiedImageUrl("HTTP://example.com/a.png")).toContain("/api/icon-proxy?url=");
    });

    it("adds a maxAge for images that change at a fixed URL", () => {
        expect(proxiedImageUrl("https://example.com/p.jpg", 120)).toMatch(/&maxAge=120$/);
        expect(proxiedImageUrl("/local.jpg", 120)).toBe("/local.jpg");
    });

    it("escapes quotes so the URL is safe inside a CSS url('...')", () => {
        expect(proxiedImageUrl("https://example.com/it's.png")).not.toContain("'");
    });

    it("leaves relative paths and data URIs alone", () => {
        expect(proxiedImageUrl("/icons/a.png")).toBe("/icons/a.png");
        expect(proxiedImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    });

    it("serves an absolute background from /api/background", () => {
        expect(backgroundImageUrl("https://example.com/bg.jpg")).toBe("/api/background");
        expect(backgroundImageUrl("/images/bg.jpg")).toBe("/images/bg.jpg");
    });

    it("treats a protocol-relative URL as a full one, since the browser would load it from another host", () => {
        expect(absoluteImageUrl("//cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
        expect(proxiedImageUrl("//cdn.example.com/a.png")).toBe(
            `/api/icon-proxy?url=${encodeURIComponent("https://cdn.example.com/a.png")}`
        );
        expect(backgroundImageUrl("//cdn.example.com/bg.jpg")).toBe("/api/background");
    });

    it("gives no absolute URL for paths and data: URIs", () => {
        expect(absoluteImageUrl("/icons/a.png")).toBeUndefined();
        expect(absoluteImageUrl("icons/a.png")).toBeUndefined();
        expect(absoluteImageUrl("data:image/png;base64,AAAA")).toBeUndefined();
        expect(absoluteImageUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    });
});
