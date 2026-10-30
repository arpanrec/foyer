export type TracearrOptions = {
    enableUser?: boolean;
    expandOneStreamToTwoRows?: boolean;
    showEpisodeNumber?: boolean;
    view?: string;
};

export type TracearrSession = {
    id: string | number;
    mediaType?: string;
    mediaTitle: string;
    showTitle?: string;
    seasonNumber: number;
    episodeNumber: number;
    username?: string;
    durationMs: number;
    progressMs: number;
    state?: string;
    videoDecision?: string;
    audioDecision?: string;
};

export type TracearrSummary = {
    total: number;
    transcodes: number;
    directPlays: number;
    totalBitrate: string;
};

export type TracearrStreams = {
    data: TracearrSession[] | null;
    summary: TracearrSummary;
};
