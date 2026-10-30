export type FrigateOptions = {
    enableRecentEvents?: boolean;
};

// Raw upstream responses
export type FrigateRawStats = {
    cameras?: Record<string, unknown>;
    service?: { uptime?: number; version?: string };
};

export type FrigateRawEvent = {
    id: string;
    camera: string;
    label: string;
    start_time: number;
    thumbnail?: string;
    data: { score: number; type?: string };
};

// What the proxy sends to the component
export type FrigateStats = {
    num_cameras: number;
    uptime?: number;
    version?: string;
};

export type FrigateEvent = {
    id: string;
    camera: string;
    label: string;
    // a Date on the server, an ISO string once serialized
    start_time: string;
    thumbnail?: string;
    score: number;
    type?: string;
};
