export type PyloadStatusData = {
    speed: number;
    active: number;
    queue: number;
    total: number;
};

// Options passed to `httpProxy` for the pyload requests
export type PyloadRequestOptions = {
    method: string;
    headers: Record<string, string>;
    body?: string;
};
