export type ProwlarrIndexerStats = {
    numberOfGrabs: number;
    numberOfQueries: number;
    numberOfFailedGrabs: number;
    numberOfFailedQueries: number;
};

export type ProwlarrStats = {
    indexers?: ProwlarrIndexerStats[];
};
