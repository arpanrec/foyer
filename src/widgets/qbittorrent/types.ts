export type QBittorrentOptions = {
    enableLeechProgress?: boolean;
    enableLeechSize?: boolean;
};

export type QBittorrentTorrent = {
    dlspeed: number;
    upspeed: number;
    progress: number;
    state: string;
    eta: number;
    name: string;
    size: number;
    amount_left: number;
};
