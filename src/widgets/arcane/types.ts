export type ArcaneOptions = {
    env?: string | number;
};

// Arcane answers a failed call with a body carrying `detail`
export type ArcaneContainerCounts = {
    detail?: string;
    runningContainers?: number;
    totalContainers?: number;
    stoppedContainers?: number;
};

export type ArcaneImageCounts = {
    detail?: string;
    totalImages?: number;
    imagesInuse?: number;
    imagesUnused?: number;
};

export type ArcaneUpdateSummary = {
    detail?: string;
    imagesWithUpdates?: number;
};

// The endpoints wrap their payload in `data`
export type ArcaneEnvelope<T> = { data: T };
