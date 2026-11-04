import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConfig } = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/utils/config/store", () => ({ getConfig }));

import cache from "@/utils/cache";
import { allowImageUrl, allowImageUrlsIn, isImageUrlAllowed, isPublicOnlyImageUrl } from "@/utils/image-allowlist";

describe("utils/image-allowlist", () => {
    beforeEach(async () => {
        vi.useRealTimers();
        await cache.clear();
        getConfig.mockReset();
        getConfig.mockReturnValue(undefined);
    });

    it("keeps each recorded address as a cache entry, and forgets it when the cache is cleared", async () => {
        await allowImageUrl("https://img.example/a.png");

        expect(await cache.keys()).toContain("imageAllowlist:https://img.example/a.png");
        await cache.clear();
        expect(await isImageUrlAllowed("https://img.example/a.png")).toBe(false);
    });

    it("refuses an address nothing handed out", async () => {
        expect(await isImageUrlAllowed("http://192.168.1.10/admin/restart")).toBe(false);
        expect(await isImageUrlAllowed("not a url")).toBe(false);
        expect(await isImageUrlAllowed("file:///etc/passwd")).toBe(false);
    });

    it("allows an icon, favicon or src written in the config", async () => {
        getConfig.mockImplementation((name: string) =>
            name === "services"
                ? [{ Media: [{ Plex: { icon: "https://cdn.example/plex.png", href: "http://plex.lan/" } }] }]
                : name === "settings"
                  ? { favicon: "//cdn.example/fav.ico", pwa: { icons: [{ src: "http://nas.lan/pwa.png" }] } }
                  : undefined
        );

        expect(await isImageUrlAllowed("https://cdn.example/plex.png")).toBe(true);
        expect(await isImageUrlAllowed("https://cdn.example/fav.ico")).toBe(true);
        expect(await isImageUrlAllowed("http://nas.lan/pwa.png")).toBe(true);
    });

    it("does not allow other strings in the config, such as a service address", async () => {
        getConfig.mockImplementation((name: string) =>
            name === "services" ? [{ Media: [{ Plex: { icon: "mdi-plex", href: "http://plex.lan/" } }] }] : undefined
        );

        expect(await isImageUrlAllowed("http://plex.lan/")).toBe(false);
    });

    it("allows a recorded address, however the URL is spelled", async () => {
        await allowImageUrl("https://img.example/a b.png");
        expect(await isImageUrlAllowed("https://img.example/a%20b.png")).toBe(true);
    });

    it("limits an address from third-party content to public hosts", async () => {
        await allowImageUrl("https://feed-img.example/a.png", { external: true });
        await allowImageUrl("https://trusted.example/b.png");

        expect(await isImageUrlAllowed("https://feed-img.example/a.png")).toBe(true);
        expect(await isPublicOnlyImageUrl("https://feed-img.example/a.png")).toBe(true);
        expect(await isPublicOnlyImageUrl("https://trusted.example/b.png")).toBe(false);
    });

    it("keeps an address unrestricted once the config or a discovery also names it", async () => {
        getConfig.mockImplementation((name: string) =>
            name === "services" ? [{ G: [{ S: { icon: "http://nas.lan/in-config.png" } }] }] : undefined
        );
        await allowImageUrl("http://nas.lan/in-config.png", { external: true });
        expect(await isPublicOnlyImageUrl("http://nas.lan/in-config.png")).toBe(false);

        await allowImageUrl("http://nas.lan/discovered.png");
        await allowImageUrl("http://nas.lan/discovered.png", { external: true });
        expect(await isPublicOnlyImageUrl("http://nas.lan/discovered.png")).toBe(false);
    });

    it("keeps a discovered address allowed after a week, and a recorded one expires", async () => {
        vi.useFakeTimers();
        await allowImageUrlsIn([{ icon: "https://found.example/kept.svg" }]);
        await allowImageUrl("https://feed.example/short.png");

        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

        expect(await isImageUrlAllowed("https://found.example/kept.svg")).toBe(true);
        expect(await isImageUrlAllowed("https://feed.example/short.png")).toBe(false);
    });

    it("does not let an expired entry lend its unrestricted flag to a third party's copy of the address", async () => {
        vi.useFakeTimers();
        await allowImageUrl("http://192.168.1.5/a.png");

        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
        await allowImageUrl("http://192.168.1.5/a.png", { external: true });

        expect(await isPublicOnlyImageUrl("http://192.168.1.5/a.png")).toBe(true);
    });

    it("ignores values that are not image addresses", async () => {
        await allowImageUrl(undefined);
        await allowImageUrl("/local/icon.png");
        await allowImageUrl("data:image/png;base64,AAAA");
        expect(await isImageUrlAllowed("/local/icon.png")).toBe(false);
    });

    it("records the icons found inside a discovery result", async () => {
        await allowImageUrlsIn([
            { name: "g", services: [{ name: "s", icon: "https://found.example/i.svg", href: "http://x.lan/" }] },
        ]);
        expect(await isImageUrlAllowed("https://found.example/i.svg")).toBe(true);
        expect(await isImageUrlAllowed("http://x.lan/")).toBe(false);
    });

    it("forgets a recorded address after a week", async () => {
        vi.useFakeTimers();
        await allowImageUrl("https://old.example/i.png");
        expect(await isImageUrlAllowed("https://old.example/i.png")).toBe(true);

        vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
        expect(await isImageUrlAllowed("https://old.example/i.png")).toBe(false);
    });

    it("ignores an address that looks absolute but does not parse", async () => {
        await allowImageUrl("http://");
        expect(await isImageUrlAllowed("http://")).toBe(false);
        expect(await isPublicOnlyImageUrl("http://")).toBe(false);
    });

    it("drops expired addresses when a new one is recorded", async () => {
        vi.useFakeTimers();
        await allowImageUrl("https://stale.example/a.png");
        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
        await allowImageUrl("https://fresh.example/b.png");

        expect(await isImageUrlAllowed("https://stale.example/a.png")).toBe(false);
        expect(await isImageUrlAllowed("https://fresh.example/b.png")).toBe(true);
    });

    it("reports no public-only limit for an unknown or expired address", async () => {
        vi.useFakeTimers();
        expect(await isPublicOnlyImageUrl("https://never.example/a.png")).toBe(false);

        await allowImageUrl("https://feed.example/a.png", { external: true });
        expect(await isPublicOnlyImageUrl("https://feed.example/a.png")).toBe(true);
        vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
        expect(await isPublicOnlyImageUrl("https://feed.example/a.png")).toBe(false);
    });
});
