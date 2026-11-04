import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { query, getServiceWidget, logger } = vi.hoisted(() => ({
    query: vi.fn(),
    getServiceWidget: vi.fn(),
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("gamedig", () => ({
    GameDig: { query },
}));

vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

import minecraftProxyHandler from "@/widgets/minecraft/proxy";

const req = { query: { group: "g", service: "svc", index: "0" } };

describe("widgets/minecraft/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns online=true with version and player data when the query succeeds", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://example.com:25565" });
        query.mockResolvedValue({ version: "1.20", numplayers: 1, maxplayers: 10 });

        const res = createMockRes();

        await minecraftProxyHandler(req, res as ApiResponse);

        expect(query).toHaveBeenCalledWith({
            type: "minecraft",
            host: "example.com",
            port: 25565,
            givenPortOnly: true,
            maxRetries: 1,
            attemptTimeout: 10000,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            version: "1.20",
            online: true,
            players: { online: 1, max: 10 },
        });
    });

    it("leaves the port to gamedig when the url has none", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://mc.example.com" });
        query.mockResolvedValue({ version: "1.21", numplayers: 0, maxplayers: 20 });

        const res = createMockRes();

        await minecraftProxyHandler(req, res as ApiResponse);

        expect(query).toHaveBeenCalledWith(expect.objectContaining({ host: "mc.example.com" }));
        expect(query.mock.calls[0]?.[0]).not.toHaveProperty("port");
        expect(res.body).toEqual({ version: "1.21", online: true, players: { online: 0, max: 20 } });
    });

    it("returns online=false and logs the error when the query fails", async () => {
        getServiceWidget.mockResolvedValue({ url: "http://example.com:25565" });
        query.mockRejectedValue(new Error("nope"));

        const res = createMockRes();

        await minecraftProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ version: undefined, online: false, players: undefined });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Minecraft server"), "svc", "g", "nope");
    });

    it("returns 400 when the widget has no url", async () => {
        getServiceWidget.mockResolvedValue({});

        const res = createMockRes();

        await minecraftProxyHandler(req, res as ApiResponse);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Invalid proxy service type" });
        expect(query).not.toHaveBeenCalled();
    });
});
