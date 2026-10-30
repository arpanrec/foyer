import cache from "memory-cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { getServiceWidget, logger } = vi.hoisted(() => ({
    getServiceWidget: vi.fn(),
    logger: {
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

vi.mock("@/utils/config/service-helpers", () => ({
    default: getServiceWidget,
}));

const { fetchTwitchChannels } = vi.hoisted(() => ({
    fetchTwitchChannels: vi.fn(),
}));

vi.mock("@/widgets/livestreamer/providers/twitch", () => ({
    fetchChannels: fetchTwitchChannels,
    TWITCH_NAME_REGEX: /^[a-z0-9_]{3,25}$/,
}));

import livestreamerProxyHandler, { parseChannelRef, providers, sortChannels } from "@/widgets/livestreamer/proxy";
import type { LiveStreamerChannel, LiveStreamerData } from "@/widgets/livestreamer/types";

type LiveStreamerBody = LiveStreamerData & { error?: { message?: string } | string };

const req = { query: { group: "g", service: "svc", index: "0" } };

const mockChannel = (overrides: Partial<LiveStreamerChannel> = {}): LiveStreamerChannel => ({
    platform: "twitch",
    login: "streamer1",
    name: "Streamer One",
    url: "https://twitch.tv/streamer1",
    exists: true,
    isLive: false,
    viewersCount: -1,
    ...overrides,
});

describe("widgets/livestreamer/proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cache.clear();
    });

    describe("parseChannelRef", () => {
        it("parses valid twitch channel refs", () => {
            expect(parseChannelRef("twitch:jembawls")).toEqual({
                platform: "twitch",
                name: "jembawls",
            });
            expect(parseChannelRef("  TWITCH:XQC  ")).toEqual({
                platform: "twitch",
                name: "xqc",
            });
            expect(parseChannelRef("twitch:streamer_123")).toEqual({
                platform: "twitch",
                name: "streamer_123",
            });
        });

        it("rejects non-string inputs", () => {
            expect(() => parseChannelRef(123)).toThrow("Invalid channel 123: entry must be a string");
            expect(() => parseChannelRef(null)).toThrow("Invalid channel null: entry must be a string");
        });

        it("rejects bare channel names without platform prefix", () => {
            expect(() => parseChannelRef("jembawls")).toThrow(
                'Invalid channel "jembawls": must be in <platform>:<name> format'
            );
        });

        it("rejects unknown platforms", () => {
            expect(() => parseChannelRef("kick:jembawls")).toThrow(
                'Invalid channel "kick:jembawls": unknown platform "kick"'
            );
        });

        it("rejects invalid twitch channel names", () => {
            expect(() => parseChannelRef("twitch:ab")).toThrow(
                'Invalid channel "twitch:ab": invalid Twitch channel name "ab"'
            );
            expect(() => parseChannelRef("twitch:has*special")).toThrow(
                'Invalid channel "twitch:has*special": invalid Twitch channel name "has*special"'
            );
        });
    });

    describe("sortChannels", () => {
        const chLiveHigh = mockChannel({ login: "a", name: "A Channel", isLive: true, viewersCount: 1000 });
        const chLiveLow = mockChannel({ login: "b", name: "B Channel", isLive: true, viewersCount: 50 });
        const chOfflineA = mockChannel({ login: "c", name: "Alpha", isLive: false, viewersCount: -1 });
        const chOfflineZ = mockChannel({ login: "d", name: "Zulu", isLive: false, viewersCount: -1 });

        it("sorts by viewers descending by default", () => {
            const sorted = sortChannels([chOfflineZ, chLiveLow, chOfflineA, chLiveHigh], "viewers");
            expect(sorted.map((c) => c.name)).toEqual(["A Channel", "B Channel", "Alpha", "Zulu"]);
        });

        it("sorts by live status first", () => {
            const sorted = sortChannels([chOfflineA, chLiveLow, chOfflineZ, chLiveHigh], "live");
            expect(sorted.map((c) => c.name)).toEqual(["A Channel", "B Channel", "Alpha", "Zulu"]);
        });

        it("sorts by name alphabetically", () => {
            const sorted = sortChannels([chOfflineZ, chLiveHigh, chOfflineA, chLiveLow], "name");
            expect(sorted.map((c) => c.name)).toEqual(["A Channel", "Alpha", "B Channel", "Zulu"]);
        });
    });

    describe("livestreamerProxyHandler", () => {
        it.each([
            ["missing", undefined],
            ["empty list", []],
            ["not an array", "twitch:foo"],
        ])("returns 400 when channels is %s", async (_, channels) => {
            getServiceWidget.mockResolvedValueOnce({ type: "livestreamer", channels });
            const res = createMockRes();

            await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(400);
            expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
                error: "channels must be a non-empty list of <platform>:<name> entries",
            });
        });

        it("returns 400 when a channel ref is invalid", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "livestreamer",
                channels: ["twitch:valid", "bare_channel"],
            });
            const res = createMockRes();

            await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(400);
            expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0].error).toContain(
                'Invalid channel "bare_channel"'
            );
        });

        it("deduplicates channels and fetches from provider", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "livestreamer",
                channels: ["twitch:streamer1", "twitch:streamer1"],
            });
            fetchTwitchChannels.mockResolvedValueOnce([mockChannel()]);
            const res = createMockRes();

            await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(fetchTwitchChannels).toHaveBeenCalledWith(["streamer1"]);
            const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as LiveStreamerBody;
            expect(body.channels).toHaveLength(1);
        });

        it("serves from cache on repeated requests", async () => {
            getServiceWidget.mockResolvedValue({
                type: "livestreamer",
                channels: ["twitch:streamer1"],
            });
            fetchTwitchChannels.mockResolvedValueOnce([mockChannel()]);

            const res1 = createMockRes();
            await livestreamerProxyHandler(req as never, res1 as unknown as ApiResponse);
            expect(res1.status).toHaveBeenCalledWith(200);
            expect(fetchTwitchChannels).toHaveBeenCalledTimes(1);

            const res2 = createMockRes();
            await livestreamerProxyHandler(req as never, res2 as unknown as ApiResponse);
            expect(res2.status).toHaveBeenCalledWith(200);
            expect(fetchTwitchChannels).toHaveBeenCalledTimes(1);
        });

        it("returns 500 when upstream provider fails for all channels", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "livestreamer",
                channels: ["twitch:streamer1"],
            });
            fetchTwitchChannels.mockRejectedValueOnce(new Error("Twitch API down"));
            const res = createMockRes();

            await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(500);
            expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
                error: { message: "Unable to fetch any channels" },
            });
        });

        it("handles partial failure across providers", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "livestreamer",
                channels: ["twitch:streamer1", "mock:streamer2"],
            });

            providers.mock = {
                validateName: () => true,
                fetchChannels: vi.fn().mockRejectedValueOnce(new Error("Mock provider failed")),
            };

            fetchTwitchChannels.mockResolvedValueOnce([mockChannel({ login: "streamer1" })]);

            try {
                const res = createMockRes();
                await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

                expect(res.status).toHaveBeenCalledWith(200);
                const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as LiveStreamerBody;
                expect(body.channels).toHaveLength(1);
                expect(body.channels[0].login).toBe("streamer1");
                expect(body.failed).toBe(1);
            } finally {
                delete providers.mock;
            }
        });

        it("handles non-existent channels returned by provider", async () => {
            getServiceWidget.mockResolvedValueOnce({
                type: "livestreamer",
                channels: ["twitch:nonexistent"],
            });
            fetchTwitchChannels.mockResolvedValueOnce([mockChannel({ login: "nonexistent", exists: false })]);
            const res = createMockRes();

            await livestreamerProxyHandler(req as never, res as unknown as ApiResponse);

            expect(res.status).toHaveBeenCalledWith(200);
            const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as LiveStreamerBody;
            expect(body.channels[0].exists).toBe(false);
        });
    });
});
