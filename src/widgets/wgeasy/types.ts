export type WgEasyOptions = {
    version?: number;
    threshold?: number;
};

export type WgEasyClient = {
    enabled?: boolean;
    latestHandshakeAt: string;
};

// An error body carries `statusCode` and `statusMessage` instead of the list
export type WgEasyClients = WgEasyClient[] & { statusCode?: number; statusMessage?: string };
