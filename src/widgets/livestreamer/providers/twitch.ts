import { asJson } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { LiveStreamerChannel } from "@/widgets/livestreamer/types";

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const CHANNEL_SHELL_HASH = "580ab410bcd0c1ad194224957ae2241e5d252b2c5173d8e0cce9d32d5bb14efe";
const STREAM_METADATA_HASH = "676ee2f834ede42eb4514cdb432b3134fefc12590080c9a2c9bb44a2a4a63266";

export const TWITCH_NAME_REGEX = /^[a-z0-9_]{3,25}$/;

type TwitchOperationResponse = {
    data?: {
        userOrError?: {
            __typename?: string;
            displayName?: string;
            profileImageURL?: string;
            stream?: {
                viewersCount?: number;
            } | null;
        } | null;
        user?: {
            stream?: {
                createdAt?: string;
                game?: {
                    name?: string;
                    slug?: string;
                } | null;
            } | null;
            lastBroadcast?: {
                title?: string;
            } | null;
        } | null;
    };
    extensions?: {
        operationName?: string;
    };
};

export async function fetchChannels(names: string[]): Promise<LiveStreamerChannel[]> {
    if (!names.length) {
        return [];
    }

    const operations = names.flatMap((login) => [
        {
            operationName: "ChannelShell",
            variables: { login },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: CHANNEL_SHELL_HASH,
                },
            },
        },
        {
            operationName: "StreamMetadata",
            variables: { channelLogin: login },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: STREAM_METADATA_HASH,
                },
            },
        },
    ]);

    const [status, , rawData] = await httpProxy(TWITCH_GQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(operations),
    });

    if (status !== 200) {
        throw new Error(`HTTP ${status} from Twitch`);
    }

    const response = asJson<TwitchOperationResponse[]>(rawData);
    if (!Array.isArray(response) || response.length !== operations.length) {
        throw new Error("Invalid response from Twitch");
    }

    const channels: LiveStreamerChannel[] = [];
    for (let i = 0; i < names.length; i++) {
        const login = names[i];
        const channelShell = response[2 * i];
        const streamMetadata = response[2 * i + 1];

        const userOrError = channelShell?.data?.userOrError;
        const url = `https://twitch.tv/${login}`;

        if (!userOrError || userOrError.__typename !== "User") {
            channels.push({
                platform: "twitch",
                login,
                name: login,
                url,
                exists: false,
                isLive: false,
                viewersCount: -1,
            });
            continue;
        }

        const isLive = Boolean(userOrError.stream);
        const viewersCount = isLive ? (userOrError.stream?.viewersCount ?? 0) : -1;
        const stream = streamMetadata?.data?.user?.stream;
        const lastBroadcast = streamMetadata?.data?.user?.lastBroadcast;

        channels.push({
            platform: "twitch",
            login,
            name: userOrError.displayName || login,
            url,
            exists: true,
            avatarUrl: userOrError.profileImageURL,
            isLive,
            viewersCount,
            game: stream?.game?.name,
            gameSlug: stream?.game?.slug,
            streamTitle: lastBroadcast?.title,
            startedAt: stream?.createdAt,
            previewUrl: isLive ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg` : undefined,
        });
    }

    return channels;
}
