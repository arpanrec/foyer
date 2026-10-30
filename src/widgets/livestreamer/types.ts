export type LiveStreamerPlatform = "twitch";

export type LiveStreamerSortBy = "viewers" | "live" | "name";

export type LiveStreamerOptions = {
    channels?: string[];
    collapseAfter?: number | string;
    sortBy?: LiveStreamerSortBy | string;
    hideOffline?: boolean | string;
    showPreview?: boolean | string;
};

export type ChannelRef = {
    platform: LiveStreamerPlatform;
    name: string;
};

export type LiveStreamerChannel = {
    platform: string;
    login: string;
    name: string;
    url: string;
    exists: boolean;
    avatarUrl?: string;
    isLive: boolean;
    viewersCount: number;
    streamTitle?: string;
    game?: string;
    gameSlug?: string;
    startedAt?: string;
    previewUrl?: string;
};

export type LiveStreamerData = {
    channels: LiveStreamerChannel[];
    failed?: number;
};
