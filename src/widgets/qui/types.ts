export type QuiOptions = {
    instance?: string | number;
};

export type QuiTorrentData = {
    stats?: {
        seeding: number;
        downloading: number;
        total: number;
        error: number;
        totalDownloadSpeed: number;
        totalUploadSpeed: number;
    };
    counts?: { status?: { all: number; completed: number; errored: number } };
    serverState?: { global_ratio: string; free_space_on_disk: number };
};
