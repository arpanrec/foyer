import { describe, expect, it } from "vitest";

import { errorDetails, errorDigest, errorMessage } from "@/utils/error";

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

    describe("errorDetails", () => {
        it("returns the stack of an Error", () => {
            const error = new RangeError("Invalid time value");
            expect(errorDetails(error)).toBe(error.stack);
        });

        it("falls back to name and message when an Error has no stack", () => {
            const error = new RangeError("Invalid time value");
            delete error.stack;
            expect(errorDetails(error)).toBe("RangeError: Invalid time value");
        });

        it("serializes a plain object", () => {
            expect(errorDetails({ digest: "abc123" })).toBe('{\n  "digest": "abc123"\n}');
        });

        it("stringifies an object that cannot be serialized", () => {
            const circular: Record<string, unknown> = {};
            circular["self"] = circular;
            expect(errorDetails(circular)).toBe("[object Object]");
        });

        it.each([
            ["boom", "boom"],
            [42, "42"],
        ])("stringifies the primitive %j", (value, expected) => {
            expect(errorDetails(value)).toBe(expected);
        });

        it.each([null, undefined])("returns undefined for %j", (value) => {
            expect(errorDetails(value)).toBeUndefined();
        });
    });
});
