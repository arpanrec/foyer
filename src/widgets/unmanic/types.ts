export type UnmanicWorker = {
    idle?: boolean;
};

export type UnmanicRawWorkers = {
    workers_status: UnmanicWorker[];
};

export type UnmanicWorkers = {
    total_workers: number;
    active_workers: number;
};

export type UnmanicPending = {
    recordsTotal: number;
};
