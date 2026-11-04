import { describe, expect, it, vi } from "vitest";

import handler from "@/app/api/revalidate/handler";
import createMockRes from "@/test-utils/create-mock-res";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { invalidateDashboardData } from "@/utils/config/dashboard";

vi.mock("@/utils/config/dashboard", () => ({ invalidateDashboardData: vi.fn() }));

describe("app/api/revalidate/handler", () => {
    it("invalidates the dashboard snapshot without regenerating a static page", async () => {
        const req = {};
        const res = Object.assign(createMockRes(), {
            revalidate: vi.fn().mockResolvedValueOnce(undefined),
        });

        await handler(req as ApiRequest, res as ApiResponse);

        expect(invalidateDashboardData).toHaveBeenCalledOnce();
        expect(res.revalidate).not.toHaveBeenCalled();
        expect(res.body).toEqual({ revalidated: true });
    });
});
