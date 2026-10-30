export type PrometheusTarget = {
    health: string;
};

export type PrometheusTargetsData = {
    data: { activeTargets: PrometheusTarget[] };
};
