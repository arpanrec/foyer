export type KopiaOptions = {
    snapshotHost?: string;
    snapshotPath?: string;
};

export type KopiaSource = {
    source: { host: string; path: string };
    status: string;
    lastSnapshot: {
        startTime: string;
        stats: { errorCount: number; totalSize: number };
    };
    nextSnapshotTime?: string;
};

export type KopiaStatus = {
    sources: KopiaSource[];
};
