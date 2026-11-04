export type StrelaysrvStatus = {
    numActiveSessions: number;
    numConnections: number;
    bytesProxied: number;
    kbps10s1m5m15m30m60m: number[];
};
