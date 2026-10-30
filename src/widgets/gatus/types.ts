export type GatusSite = {
    results: { success?: boolean }[];
};

// Keyed by the monitored endpoint
export type GatusStatus = Record<string, GatusSite>;
