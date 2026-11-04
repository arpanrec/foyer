import { afterEach, describe, expect, it, vi } from "vitest";

import { foyerUserAgent } from "@/utils/proxy/user-agent";

describe("utils/proxy/user-agent", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("sends foyer/<version> to ordinary hosts", () => {
        vi.stubEnv("NEXT_PUBLIC_VERSION", "1.2.3");
        expect(foyerUserAgent("https://example.com/a.png")).toBe("foyer/1.2.3");
    });

    it("falls back to dev without a version", () => {
        vi.stubEnv("NEXT_PUBLIC_VERSION", "");
        expect(foyerUserAgent(new URL("https://example.com/"))).toBe("foyer/dev");
    });

    it("sends Reddit's documented shape to Reddit hosts", () => {
        vi.stubEnv("NEXT_PUBLIC_VERSION", "1.2.3");
        const expected = "foyer:self-hosted-dashboard:1.2.3 (+https://github.com/arpanrec/foyer)";
        for (const url of [
            "https://www.reddit.com/r/technology/.rss",
            "https://old.reddit.com/r/x/.rss",
            "https://external-preview.redd.it/a.jpeg",
            "https://preview.redd.it/a.png",
            "https://styles.redditmedia.com/a.png",
        ]) {
            expect(foyerUserAgent(url)).toBe(expected);
        }
    });

    it("does not treat look-alike hosts as Reddit", () => {
        expect(foyerUserAgent("https://notreddit.com/")).toMatch(/^foyer\//);
        expect(foyerUserAgent("https://reddit.com.evil.example/")).toMatch(/^foyer\//);
    });
});
