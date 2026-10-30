import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { fetchChannels as fetchTwitchChannels, TWITCH_NAME_REGEX } from "@/widgets/livestreamer/providers/twitch";
import type {
    ChannelRef,
    LiveStreamerChannel,
    LiveStreamerData,
    LiveStreamerOptions,
    LiveStreamerPlatform,
    LiveStreamerSortBy,
} from "@/widgets/livestreamer/types";

const logger = createLogger("livestreamerProxyHandler");
const CACHE_MS = 60 * 1000; // 1 minute

type Provider = {
    validateName: (name: string) => boolean;
    fetchChannels: (names: string[]) => Promise<LiveStreamerChannel[]>;
};

export const providers: Record<string, Provider> = {
    twitch: {
        validateName: (name) => TWITCH_NAME_REGEX.test(name),
        fetchChannels: fetchTwitchChannels,
    },
};

export function parseChannelRef(entry: unknown): ChannelRef {
    if (typeof entry !== "string") {
        throw new Error(`Invalid channel ${JSON.stringify(entry)}: entry must be a string`);
    }
    const trimmed = entry.trim();
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
        throw new Error(`Invalid channel "${entry}": must be in <platform>:<name> format`);
    }
    const platform = trimmed.slice(0, colonIndex).toLowerCase();
    const name = trimmed.slice(colonIndex + 1).toLowerCase();

    const provider = providers[platform];
    if (!provider) {
        throw new Error(`Invalid channel "${entry}": unknown platform "${platform}"`);
    }

    if (!provider.validateName(name)) {
        const platformLabel = platform === "twitch" ? "Twitch" : platform;
        throw new Error(`Invalid channel "${entry}": invalid ${platformLabel} channel name "${name}"`);
    }

    return { platform: platform as LiveStreamerPlatform, name };
}

export function sortChannels(
    channels: LiveStreamerChannel[],
    sortBy: LiveStreamerSortBy | string
): LiveStreamerChannel[] {
    const sorted = [...channels];
    if (sortBy === "name") {
        return sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    if (sortBy === "live") {
        return sorted.sort((a, b) => {
            if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
            return b.viewersCount - a.viewersCount;
        });
    }
    // default: "viewers"
    return sorted.sort((a, b) => {
        if (a.viewersCount !== b.viewersCount) return b.viewersCount - a.viewersCount;
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

export default async function livestreamerProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query as Record<string, string>;
    const widget = await getServiceWidget(group, service, index);
    const options = widget as (WidgetConfig & LiveStreamerOptions) | undefined;

    const rawChannels = options?.channels;
    if (!Array.isArray(rawChannels) || rawChannels.length === 0) {
        return res.status(400).json({ error: "channels must be a non-empty list of <platform>:<name> entries" });
    }

    let refs: ChannelRef[];
    try {
        refs = rawChannels.map(parseChannelRef);
    } catch (e) {
        return res.status(400).json({ error: errorMessage(e) });
    }

    const seen = new Set<string>();
    const uniqueRefs: ChannelRef[] = [];
    for (const ref of refs) {
        const key = `${ref.platform}:${ref.name}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRefs.push(ref);
        }
    }

    const rawSortBy = (options?.sortBy ?? "viewers") as string;
    const sortBy: LiveStreamerSortBy = rawSortBy === "name" || rawSortBy === "live" ? rawSortBy : "viewers";

    const sortedRefKeys = [...seen].sort().join(",");
    const cacheKey = `livestreamer:${sortBy}:${sortedRefKeys}`;
    const cached = cache.get(cacheKey) as LiveStreamerData | null;
    if (cached) {
        return res.status(200).json(cached);
    }

    const platformGroups = new Map<LiveStreamerPlatform, string[]>();
    for (const ref of uniqueRefs) {
        const list = platformGroups.get(ref.platform) ?? [];
        list.push(ref.name);
        platformGroups.set(ref.platform, list);
    }

    const platformEntries = Array.from(platformGroups.entries());
    const results = await Promise.allSettled(
        platformEntries.map(([platform, names]) => providers[platform].fetchChannels(names))
    );

    const channels: LiveStreamerChannel[] = [];
    let failedCount = 0;

    results.forEach((result, i) => {
        const [platform, names] = platformEntries[i];
        if (result.status === "fulfilled") {
            channels.push(...result.value);
        } else {
            logger.error("Failed to fetch %s channels: %s", platform, result.reason);
            failedCount += names.length;
        }
    });

    if (!channels.length) {
        return res.status(500).json({ error: { message: "Unable to fetch any channels" } });
    }

    const sortedChannels = sortChannels(channels, sortBy);
    const data: LiveStreamerData = {
        channels: sortedChannels,
        ...(failedCount > 0 ? { failed: failedCount } : {}),
    };

    cache.put(cacheKey, data, CACHE_MS);
    return res.status(200).json(data);
}
