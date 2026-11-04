export type SyncthingConnections = {
    connections: Record<string, { connected: boolean }>;
};

export type SyncthingCompletion = {
    completion: number;
    globalBytes: number;
};

export type SyncthingErrors = {
    errors?: unknown[] | null;
};
