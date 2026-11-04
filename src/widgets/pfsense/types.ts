export type PfsenseOptions = {
    version?: number;
    wan?: string;
};

export type PfsenseSystemData = {
    data: {
        mem_usage: number;
        disk_usage: number;
        load_avg: number[];
        cpu_load_avg: number[];
        temp_c: number;
    };
};

export type PfsenseInterface = {
    hwif: string;
    status: string;
    ipaddr: string;
};

export type PfsenseInterfaceData = {
    data: PfsenseInterface[];
};
