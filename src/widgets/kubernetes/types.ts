export type KubernetesOptions = {
    namespace?: string | undefined;
    app?: string | undefined;
    podSelector?: string | undefined;
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
