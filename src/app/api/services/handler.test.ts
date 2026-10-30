import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";

const { servicesResponse } = vi.hoisted(() => ({
    servicesResponse: vi.fn(),
}));

vi.mock("@/utils/config/api-response", () => ({
    servicesResponse,
}));

import handler from "@/app/api/services/handler";

describe("app/api/services/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns servicesResponse()", async () => {
        servicesResponse.mockResolvedValueOnce({ services: [] });

        const req = {};
        const res = createMockRes();

        await handler(req as ApiRequest, res as ApiResponse);

        expect(res.body).toEqual({ services: [] });
    });
});
