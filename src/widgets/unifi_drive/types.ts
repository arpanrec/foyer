export type UnifiDrivePool = {
    capacity?: number;
    usage?: number;
    status?: string;
};

export type UnifiDriveStorage = {
    pools?: UnifiDrivePool[];
};
