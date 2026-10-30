export type UptimeKumaStatusPage = {
    incident?: { createdDate: string } | null;
};

export type UptimeKumaHeartbeats = {
    heartbeatList: Record<string, { status?: number }[]>;
    uptimeList: Record<string, number>;
};
