import { createHash } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

function sha256(input: string) {
    return createHash("sha256").update(input).digest("hex");
}

const { getConfigHash } = vi.hoisted(() => ({
    getConfigHash: vi.fn(() => "abcd"),
}));

vi.mock("@/utils/config/store", () => ({
    getConfigHash,
}));

import handler from "@/app/api/hash/handler";

describe("app/api/hash/handler", () => {
    const originalBuildTime = process.env["FOYER_BUILDTIME"];

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["FOYER_BUILDTIME"] = originalBuildTime;
    });

    it("hashes the config hash and the build time", async () => {
        process.env["FOYER_BUILDTIME"] = "build-1";

        const res = createMockRes();
        await handler({ query: {} }, res as ApiResponse);

        expect(res.body).toEqual({ hash: sha256("abcd" + "build-1") });
    });

    it("changes when the loaded config changes", async () => {
        const first = createMockRes();
        await handler({ query: {} }, first as ApiResponse);

        getConfigHash.mockReturnValueOnce("efgh");
        const second = createMockRes();
        await handler({ query: {} }, second as ApiResponse);

        expect(second.body).not.toEqual(first.body);
    });
});
