export type DockhandOptions = {
    environment?: string | number | undefined;
    username?: string | undefined;
    password?: string | undefined;
    key?: string | undefined;
};

export type DockhandEnvironment = {
    id?: string | number | undefined;
    name?: string | undefined;
    containers?: {
        running?: number | undefined;
        stopped?: number | undefined;
        total?: number | undefined;
        paused?: number | undefined;
        pendingUpdates?: number | undefined;
    };
    metrics?: { cpuPercent?: number | undefined; memoryPercent?: number | undefined };
    images?: { total?: number | undefined };
    volumes?: { total?: number | undefined };
    stacks?: { running?: number | undefined; total?: number | undefined };
    events?: { today?: number | undefined };
};

export type DockhandStats = DockhandEnvironment[];
