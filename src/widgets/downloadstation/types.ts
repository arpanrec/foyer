export type DownloadStationTask = {
    size?: number;
    additional?: {
        transfer?: {
            speed_download?: number;
            speed_upload?: number;
            size_downloaded?: number;
        };
    };
};

export type DownloadStationList = {
    data?: { tasks?: DownloadStationTask[] };
};
