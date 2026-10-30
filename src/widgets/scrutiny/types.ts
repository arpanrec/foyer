export type ScrutinyDevice = {
    device: {
        archived?: boolean;
        device_status: number;
    };
};

export type ScrutinySummary = {
    data: {
        summary: Record<string, ScrutinyDevice>;
    };
};

export type ScrutinySettings = {
    settings: {
        metrics: {
            status_threshold: number;
        };
    };
};
