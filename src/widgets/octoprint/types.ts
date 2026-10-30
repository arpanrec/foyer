export type OctoprintPrinterStats = {
    state?: { text?: string };
    temperature?: {
        tool0?: { actual?: number };
        bed?: { actual?: number };
    };
};

export type OctoprintJobStats = {
    state?: string;
    progress?: { completion?: number };
};
