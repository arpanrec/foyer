export type DiskStationOptions = {
    volume?: string;
};

export type DiskStationVolume = {
    name?: string;
    used_size: string;
    total_size: string;
};

export type DiskStationInfo = {
    data: { up_time: string };
};

export type DiskStationStorage = {
    data: { vol_info?: DiskStationVolume[] };
};

export type DiskStationUtilization = {
    data: {
        cpu: { user_load: string; system_load: string };
        memory: { real_usage?: string; avail_real: string; cached: string; total_real: string };
    };
};
