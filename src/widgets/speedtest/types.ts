export type SpeedtestOptions = {
    version?: number;
    bitratePrecision?: number;
};

export type SpeedtestResult = {
    data: {
        download: number;
        upload: number;
        ping: number;
    };
};
