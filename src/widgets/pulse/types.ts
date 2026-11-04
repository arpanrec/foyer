export type PulseOptions = {
    version?: number;
};

export type PulseResource = {
    type: string;
    status?: string;
};

export type PulseData = {
    // v2 (pulse v6) summary
    nodes?: number;
    vms?: number;
    containers?: number;
    // v1 resources
    count?: number;
    resources?: PulseResource[];
    stats?: { byType?: Record<string, number | undefined> };
};
