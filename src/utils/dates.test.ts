import { describe, expect, it } from "vitest";

import { byDateDesc, toIsoDate } from "@/utils/dates";

describe("toIsoDate", () => {
    it("converts a date string to an ISO 8601 string", () => {
        expect(toIsoDate("Tue, 22 Sep 2026 10:00:00 GMT")).toBe("2026-09-22T10:00:00.000Z");
        expect(toIsoDate("2026-09-01T10:00:00Z")).toBe("2026-09-01T10:00:00.000Z");
    });

    it("returns null for a missing or unreadable date", () => {
        expect(toIsoDate(undefined)).toBeNull();
        expect(toIsoDate("")).toBeNull();
        expect(toIsoDate("not a date")).toBeNull();
    });
});

describe("byDateDesc", () => {
    it("sorts newest first and undated items last", () => {
        const items = [
            { id: "none", date: null },
            { id: "old", date: "2026-09-01T00:00:00.000Z" },
            { id: "new", date: "2026-09-22T00:00:00.000Z" },
        ];
        expect([...items].sort(byDateDesc).map((item) => item.id)).toEqual(["new", "old", "none"]);
    });
});
