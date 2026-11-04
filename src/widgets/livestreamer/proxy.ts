import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import cache from "@/utils/cache";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import { allowImageUrl } from "@/utils/image-allowlist";
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
        logger.warn(
            "channels must be a non-empty list of <platform>:<name> entries for service '%s' in group '%s'",
            service,
            group
        );
        return res.status(400).json({ error: "channels must be a non-empty list of <platform>:<name> entries" });
    }

    let refs: ChannelRef[];
    try {
        refs = rawChannels.map(parseChannelRef);
    } catch (e) {
        logger.warn("Invalid channels for service '%s' in group '%s': %s", service, group, errorMessage(e));
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
    const data = await cache.getOrFetch<LiveStreamerData>(
        cacheKey,
        async () => {
            const platformGroups = new Map<LiveStreamerPlatform, string[]>();
            for (const ref of uniqueRefs) {
                const list = platformGroups.get(ref.platform) ?? [];
                list.push(ref.name);
                platformGroups.set(ref.platform, list);
            }

            const platformEntries = Array.from(platformGroups.entries());
            const results = await Promise.allSettled(
                platformEntries.map(([platform, names]) => {
                    const provider = providers[platform];
                    return provider
                        ? provider.fetchChannels(names)
                        : Promise.reject(new Error(`unknown platform ${platform}`));
                })
            );

            const channels: LiveStreamerChannel[] = [];
            let failedCount = 0;

            results.forEach((result, i) => {
                const [platform, names] = platformEntries[i] ?? ["", []];
                if (result.status === "fulfilled") {
                    channels.push(...result.value);
                } else {
                    logger.error("Failed to fetch %s channels: %s", platform, result.reason);
                    failedCount += names.length;
                }
            });

            // nothing to show is not cached, so the next request asks the platforms again
            if (!channels.length) return undefined;

            const sortedChannels = sortChannels(channels, sortBy);
            const loaded: LiveStreamerData = {
                channels: sortedChannels,
                ...(failedCount > 0 ? { failed: failedCount } : {}),
            };
            return loaded;
        },
        { type: "response", ttlMs: CACHE_MS }
    );
    if (!data) return res.status(500).json({ error: { message: "Unable to fetch any channels" } });
    // the browser loads these images through /api/icon-proxy, which only fetches addresses recorded here
    await Promise.all(
        data.channels.flatMap((channel) => [
            allowImageUrl(channel.avatarUrl, { external: true }),
            allowImageUrl(channel.previewUrl, { external: true }),
        ])
    );
    return res.status(200).json(data);
}
