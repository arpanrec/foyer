export type NavidromeEntry = {
    id?: string;
    username?: string;
    artist?: string;
    title: string;
    album?: string;
};

export type NavidromeNowPlaying = {
    "subsonic-response": {
        error?: unknown;
        nowPlaying: { entry?: Record<string, NavidromeEntry> };
    };
};
