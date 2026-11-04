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
    trackedDownloadState?: string | undefined;
    trackedDownloadStatus?: string | undefined;
    timeLeft?: string | undefined;
    size: number;
    sizeLeft: number;
    seriesId?: number | undefined;
    episodeTitle?: string | undefined;
    episodeId?: number | undefined;
    status?: string | undefined;
};

export type SonarrRecordCount = {
    totalRecords: number;
};
