export type DelugeOptions = {
    enableLeechProgress?: boolean;
};

export type DelugeTorrent = {
    download_payload_rate: number;
    upload_payload_rate: number;
    total_remaining: number;
    state: string;
    progress: number;
    eta: number;
    name: string;
};

export type DelugeData = {
    torrents?: Record<string, DelugeTorrent>;
};

// The JSON-RPC reply the proxy inspects for an error
export type DelugeRpcReply = {
    error?: { code?: number } | null;
};
