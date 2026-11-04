export type ImmichOptions = {
    version?: number;
};

export type ImmichVersion = {
    major: number;
    minor: number;
};

export type ImmichStats = {
    statusCode?: number;
    usageByUser: unknown[];
    photos: number;
    videos: number;
    usage: number | string;
};
