export type FloodTorrent = {
    downRate: number;
    upRate: number;
    status: string[];
};

export type FloodTorrents = {
    torrents?: Record<string, FloodTorrent>;
};
