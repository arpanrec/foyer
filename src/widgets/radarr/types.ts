export type RadarrOptions = {
    enableQueue?: boolean;
};

export type RadarrMovie = {
    title: string;
    id: number;
    monitored?: boolean;
    hasFile?: boolean;
    isAvailable?: boolean;
};

export type RadarrMovieData = {
    wanted: number;
    have: number;
    missing: number;
    all: Pick<RadarrMovie, "title" | "id">[];
};

export type RadarrQueueStatus = {
    totalCount: number;
};

// An entry of `queue/details` as returned by Radarr
export type RadarrRawQueueEntry = {
    trackedDownloadState?: string;
    trackedDownloadStatus?: string;
    timeleft?: string;
    size: number;
    sizeleft: number;
    movieId?: number;
    id: number;
    status?: string;
};

// An entry of `queue/details` as mapped for the component
export type RadarrQueueEntry = {
    trackedDownloadState?: string;
    trackedDownloadStatus?: string;
    timeLeft?: string;
    size: number;
    sizeLeft: number;
    movieId: number;
    status?: string;
};
