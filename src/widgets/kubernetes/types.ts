export type KubernetesOptions = {
    namespace?: string;
    app?: string;
    podSelector?: string;
};

export type KubernetesWidgetOptions = KubernetesOptions;

export type KubernetesStatusResponse = {
    status?: string;
};

export type KubernetesStats = {
    cpu: number;
    mem: number;
    cpuLimit?: number | boolean;
    cpuUsage?: number;
};

export type KubernetesStatsResponse = {
    stats: KubernetesStats;
};
