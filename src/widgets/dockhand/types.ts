export type DockhandOptions = {
    environment?: string | number;
    username?: string;
    password?: string;
    key?: string;
};

export type DockhandEnvironment = {
    id?: string | number;
    name?: string;
    containers?: {
        running?: number;
        stopped?: number;
        total?: number;
        paused?: number;
        pendingUpdates?: number;
    };
    metrics?: { cpuPercent?: number; memoryPercent?: number };
    images?: { total?: number };
    volumes?: { total?: number };
    stacks?: { running?: number; total?: number };
    events?: { today?: number };
};

export type DockhandStats = DockhandEnvironment[];
