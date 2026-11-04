import { describe, expect, it } from "vitest";

import handler from "@/app/api/healthcheck/handler";
import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

describe("app/api/healthcheck/handler", () => {
    it("returns 'up'", () => {
        const req = {};
        const res = createMockRes();

        handler(req as ApiRequest, res as ApiResponse);

        expect(res.body).toBe("up");
    });
});
