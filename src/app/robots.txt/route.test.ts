import { describe, expect, it, vi } from "vitest";

const { getSettings } = vi.hoisted(() => ({
    getSettings: vi.fn(),
}));

vi.mock("@/utils/config/config", () => ({
    getSettings,
}));

import { dynamic, GET } from "@/app/robots.txt/route";

describe("app/robots.txt", () => {
    it("allows indexing when disableIndexing is falsey", async () => {
        getSettings.mockReturnValueOnce({ disableIndexing: false });

        const res = GET();

        expect(res.headers.get("Content-Type")).toBe("text/plain");
        expect(await res.text()).toBe("User-agent: *\nAllow: /");
    });

    it("disallows indexing when disableIndexing is truthy", async () => {
        getSettings.mockReturnValueOnce({ disableIndexing: true });

        expect(await GET().text()).toBe("User-agent: *\nDisallow: /");
    });

    it("reads settings on every request", () => {
        expect(dynamic).toBe("force-dynamic");
    });
});
