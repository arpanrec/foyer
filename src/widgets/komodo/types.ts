export type KomodoOptions = {
    showSummary?: boolean;
    showStacks?: boolean;
    secret?: string;
};

export type KomodoServersSummary = {
    healthy: number;
    total: number;
};

export type KomodoStacksSummary = {
    total: number;
    running: number;
    stopped: number;
    down: number;
    unhealthy: number;
    unknown: number;
};

export type KomodoContainersSummary = {
    total: number;
    running: number;
    stopped: number;
    unhealthy: number;
    unknown: number;
};
