import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { bookmarksResponse } = vi.hoisted(() => ({
    bookmarksResponse: vi.fn(),
}));

vi.mock("@/utils/config/api-response", () => ({
    bookmarksResponse,
}));

import handler from "@/app/api/bookmarks/handler";

describe("app/api/bookmarks/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns bookmarksResponse()", async () => {
        bookmarksResponse.mockResolvedValueOnce({ ok: true });

        const req = { query: {} };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ ok: true });
    });
});
