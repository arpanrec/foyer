import { beforeEach, describe, expect, it, vi } from "vitest";

const { httpProxy } = vi.hoisted(() => ({ httpProxy: vi.fn() }));
vi.mock("@/utils/proxy/http", () => ({ httpProxy }));

import { fetchChannels } from "@/widgets/livestreamer/providers/twitch";

describe("widgets/livestreamer/providers/twitch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when names list is empty", async () => {
        const result = await fetchChannels([]);
        expect(result).toEqual([]);
        expect(httpProxy).not.toHaveBeenCalled();
    });

    it("batches GQL operations and maps response correctly", async () => {
        const mockGqlResponse = [
            // streamer1: ChannelShell
            {
                data: {
                    userOrError: {
                        __typename: "User",
                        displayName: "Streamer One",
                        profileImageURL: "https://example.com/avatar1.jpg",
                        stream: {
                            viewersCount: 1250,
                        },
                    },
                },
            },
            // streamer1: StreamMetadata
            {
                data: {
                    user: {
                        stream: {
                            createdAt: "2026-10-24T08:00:00Z",
                            game: {
                                name: "Just Chatting",
                                slug: "just-chatting",
                            },
                        },
                        lastBroadcast: {
                            title: "Morning stream",
                        },
                    },
                },
            },
            // streamer2: ChannelShell (offline)
            {
                data: {
                    userOrError: {
                        __typename: "User",
                        displayName: "Streamer Two",
                        profileImageURL: "https://example.com/avatar2.jpg",
                        stream: null,
                    },
                },
            },
            // streamer2: StreamMetadata
            {
                data: {
                    user: {
                        stream: null,
                        lastBroadcast: {
                            title: "Yesterday vod",
                        },
                    },
                },
            },
        ];

        httpProxy.mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify(mockGqlResponse)), {}]);

        const result = await fetchChannels(["streamer1", "streamer2"]);

        expect(httpProxy).toHaveBeenCalledWith(
            "https://gql.twitch.tv/gql",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                    "Content-Type": "application/json",
                },
            })
        );

        const callBody = JSON.parse(httpProxy.mock.calls[0][1].body);
        expect(callBody).toHaveLength(4);
        expect(callBody[0].operationName).toBe("ChannelShell");
        expect(callBody[0].variables).toEqual({ login: "streamer1" });
        expect(callBody[1].operationName).toBe("StreamMetadata");
        expect(callBody[1].variables).toEqual({ channelLogin: "streamer1" });

        expect(result).toHaveLength(2);

        // Live streamer
        expect(result[0]).toEqual({
            platform: "twitch",
            login: "streamer1",
            name: "Streamer One",
            url: "https://twitch.tv/streamer1",
            exists: true,
            avatarUrl: "https://example.com/avatar1.jpg",
            isLive: true,
            viewersCount: 1250,
            game: "Just Chatting",
            gameSlug: "just-chatting",
            streamTitle: "Morning stream",
            startedAt: "2026-10-24T08:00:00Z",
            previewUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_streamer1-440x248.jpg",
        });

        // Offline streamer
        expect(result[1]).toEqual({
            platform: "twitch",
            login: "streamer2",
            name: "Streamer Two",
            url: "https://twitch.tv/streamer2",
            exists: true,
            avatarUrl: "https://example.com/avatar2.jpg",
            isLive: false,
            viewersCount: -1,
            game: undefined,
            gameSlug: undefined,
            streamTitle: "Yesterday vod",
            startedAt: undefined,
            previewUrl: undefined,
        });
    });

    it("handles non-existent channels correctly", async () => {
        const mockGqlResponse = [
            {
                data: {
                    userOrError: {
                        __typename: "UserNotFoundError",
                    },
                },
            },
            {
                data: {
                    user: null,
                },
            },
        ];

        httpProxy.mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify(mockGqlResponse)), {}]);

        const result = await fetchChannels(["ghost_user"]);

        expect(result).toEqual([
            {
                platform: "twitch",
                login: "ghost_user",
                name: "ghost_user",
                url: "https://twitch.tv/ghost_user",
                exists: false,
                isLive: false,
                viewersCount: -1,
            },
        ]);
    });

    it("throws on non-200 HTTP status", async () => {
        httpProxy.mockResolvedValueOnce([503, "text/plain", Buffer.from("Service Unavailable"), {}]);

        await expect(fetchChannels(["streamer1"])).rejects.toThrow("HTTP 503 from Twitch");
    });

    it("throws on malformed or invalid response length", async () => {
        httpProxy.mockResolvedValueOnce([
            200,
            "application/json",
            Buffer.from(JSON.stringify([{ unexpected: "response" }])),
            {},
        ]);

        await expect(fetchChannels(["streamer1"])).rejects.toThrow("Invalid response from Twitch");
    });
});
