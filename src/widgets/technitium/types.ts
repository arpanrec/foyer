export type TechnitiumOptions = {
    node?: string;
    range?: string;
};

export type TechnitiumRawStats = {
    response?: {
        stats?: TechnitiumStats;
    };
};

export type TechnitiumStats = {
    totalQueries: number;
    totalNoError: number;
    totalServerFailure: number;
    totalNxDomain: number;
    totalRefused: number;
    totalAuthoritative: number;
    totalRecursive: number;
    totalCached: number;
    totalBlocked: number;
    totalDropped: number;
    totalClients: number;
};
