export type TruenasOptions = {
    version?: number | string;
    enablePools?: boolean;
};

export type TruenasAlert = {
    dismissed?: boolean;
};

export type TruenasRawPool = {
    name: string;
    healthy: boolean;
};

export type TruenasAlerts = {
    pending: number;
};

export type TruenasStatus = {
    loadavg: number[];
    uptime_seconds: number;
};

export type TruenasPool = {
    id: string;
    name: string;
    healthy: boolean;
};

export type TruenasDataset = {
    pool: string;
    name: string;
    used?: { parsed: number };
    available?: { parsed: number };
};

// A message of the TrueNAS JSON-RPC websocket
export type TruenasRpcMessage = {
    id?: number;
    error?: { message?: string };
    result?: unknown;
};
