import { describe, expect, it } from "vitest";

import { errorDigest, errorMessage } from "@/utils/error";

describe("utils/error", () => {
    describe("errorMessage", () => {
        it("reads message from an Error instance", () => {
            expect(errorMessage(new Error("boom"))).toBe("boom");
        });

        it("reads message from any object that carries one", () => {
            expect(errorMessage({ message: "boom" })).toBe("boom");
        });

        it.each([null, undefined, "boom", 42, {}])("returns undefined for %j", (value) => {
            expect(errorMessage(value)).toBeUndefined();
        });
    });

    describe("errorDigest", () => {
        it("reads digest from an error carrying one", () => {
            expect(errorDigest({ digest: "abc123" })).toBe("abc123");
        });

        it.each([null, undefined, "boom", 42, new Error("boom")])("returns undefined for %j", (value) => {
            expect(errorDigest(value)).toBeUndefined();
        });
    });
});
