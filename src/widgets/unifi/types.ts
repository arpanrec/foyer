export type UnifiOptions = {
    site?: string;
};

export type UnifiHealth = {
    subsystem: string;
    status: string;
    num_user?: number;
    num_adopted?: number;
    "gw_system-stats"?: { uptime: number };
    // set by the component from `status`
    up?: boolean;
    show?: boolean;
};

export type UnifiSite = {
    name?: string;
    desc?: string;
    health: UnifiHealth[];
};

export type UnifiSites = {
    data: UnifiSite[];
};
