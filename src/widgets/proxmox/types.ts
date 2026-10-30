export type ProxmoxOptions = {
    node?: string;
};

export type ProxmoxResource = {
    type: string;
    status?: string;
    template?: number;
    node?: string;
    maxmem: number;
    mem: number;
    maxcpu: number;
    cpu: number;
};

export type ProxmoxClusterData = {
    data: ProxmoxResource[];
};
