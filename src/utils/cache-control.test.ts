import { describe, expect, it } from "vitest";

import { requestsNoCache } from "@/utils/cache-control";

describe("utils/cache-control", () => {
    it("finds no-cache among the Cache-Control directives, in any case and with other directives", () => {
        expect(requestsNoCache({ "cache-control": "no-cache" })).toBe(true);
        expect(requestsNoCache({ "cache-control": "max-age=0, No-Cache" })).toBe(true);
        expect(requestsNoCache({ "cache-control": 'no-cache="set-cookie"' })).toBe(true);
    });

    it("leaves a normal reload, max-age=0 and other directives to the cache", () => {
        expect(requestsNoCache({ "cache-control": "max-age=0" })).toBe(false);
        expect(requestsNoCache({ "cache-control": "no-store" })).toBe(false);
        expect(requestsNoCache({ "cache-control": "" })).toBe(false);
        expect(requestsNoCache({})).toBe(false);
        expect(requestsNoCache(undefined)).toBe(false);
    });

    it("reads Pragma: no-cache only when there is no Cache-Control header", () => {
        expect(requestsNoCache({ pragma: "no-cache" })).toBe(true);
        expect(requestsNoCache({ pragma: "x-other" })).toBe(false);
        expect(requestsNoCache({ pragma: "no-cache", "cache-control": "max-age=60" })).toBe(false);
    });

    it("reads a header that arrives as a list of values", () => {
        // IncomingHttpHeaders types these as strings, but a Node adapter may hand over repeated headers as a list
        const headers = { "cache-control": ["max-age=0", "no-cache"] } as unknown as Record<string, string>;
        expect(requestsNoCache(headers)).toBe(true);
    });
});
