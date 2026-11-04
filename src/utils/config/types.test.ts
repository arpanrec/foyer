import { describe, expect, it } from "vitest";

import { firstEntry, isRecord } from "@/utils/config/types";

describe("utils/config/types", () => {
    describe("firstEntry", () => {
        it("returns the key and value of a single-key object", () => {
            expect(firstEntry({ Media: [1, 2] })).toEqual(["Media", [1, 2]]);
        });

        it("returns undefined for an empty object", () => {
            expect(firstEntry({})).toBeUndefined();
        });
    });

    describe("isRecord", () => {
        it.each([{}, { a: 1 }])("accepts the object %j", (value) => {
            expect(isRecord(value)).toBe(true);
        });

        it.each([null, undefined, [], "a", 1])("rejects %j", (value) => {
            expect(isRecord(value)).toBe(false);
        });
    });
});
