import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    logger: { error: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));
vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));
vi.mock("@/utils/proxy/http", () => ({
    httpProxy,
}));
vi.mock("@/widgets/widgets", () => ({
    default: {
        rutorrent: {
            api: "{url}",
        },
    },
}));

import rutorrentProxyHandler from "@/widgets/rutorrent/proxy";

describe("widgets/rutorrent/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("parses torrent list data into an array", async () => {
        getServiceWidget.mockResolvedValue({ type: "rutorrent", url: "http://ru", username: "u", password: "p" });
        httpProxy.mockResolvedValueOnce([200, "application/json", JSON.stringify({ t: { hash1: Array(34).fill(0) } })]);

        const req = { query: { group: "g", service: "svc", index: "0" } };
        const res = createMockRes<Record<string, unknown>[]>();

        await rutorrentProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]["d.get_name"]).toBe(0);
    });
});
