export type GrafanaOptions = {
    version?: number;
    alerts?: string;
};

export type GrafanaStats = {
    dashboards: number;
    datasources: number;
    alerts: number;
};

export type GrafanaAlert = {
    state?: string;
};
