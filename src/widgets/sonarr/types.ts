export type SonarrOptions = {
    enableQueue?: boolean;
};

export type SonarrSeries = {
    title: string;
    id: number;
};

export type SonarrRawQueueEntry = {
    trackedDownloadState?: string;
    trackedDownloadStatus?: string;
    timeleft?: string;
    size: number;
    sizeleft: number;
    seriesId?: number;
    episode?: { title?: string };
    title?: string;
    episodeId?: number;
    id?: number;
    status?: string;
};

export type SonarrQueueEntry = {
    trackedDownloadState?: string;
    trackedDownloadStatus?: string;
    timeLeft?: string;
    size: number;
    sizeLeft: number;
    seriesId?: number;
    episodeTitle?: string;
    episodeId?: number;
    status?: string;
};

export type SonarrRecordCount = {
    totalRecords: number;
};
