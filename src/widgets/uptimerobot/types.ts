export type UptimeRobotLog = {
    type: number;
    duration?: number;
    datetime: number;
};

export type UptimeRobotMonitor = {
    status: number;
    logs?: UptimeRobotLog[];
};

export type UptimeRobotMonitors = {
    error?: unknown;
    pagination?: { total: number };
    monitors: UptimeRobotMonitor[];
};
