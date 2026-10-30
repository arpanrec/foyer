import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { widgetsResponse } = vi.hoisted(() => ({
    widgetsResponse: vi.fn(),
}));

vi.mock("@/utils/config/api-response", () => ({
    widgetsResponse,
}));

import handler from "@/app/api/widgets/handler";

describe("app/api/widgets/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns widgetsResponse()", async () => {
        widgetsResponse.mockResolvedValueOnce([{ type: "logo", options: {} }]);

        const req = { query: {} };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual([{ type: "logo", options: {} }]);
    });
});
