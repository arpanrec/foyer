export type PrometheusMetricFormat = {
    scale?: number | string;
    type?: string;
    options?: Record<string, unknown>;
    prefix?: string;
    suffix?: string;
};

export type PrometheusMetric = {
    label: string;
    key?: string;
    query: string;
    refreshInterval?: number;
    format?: PrometheusMetricFormat;
};

export type PrometheusmetricOptions = {
    metrics?: PrometheusMetric[];
    refreshInterval?: number;
};

// [timestamp, value]
export type PrometheusSample = [number, string];

export type PrometheusQueryData = {
    data?:
        | { resultType: "vector"; result?: { value?: PrometheusSample }[] }
        | { resultType: "scalar"; result?: PrometheusSample }
        | { resultType: "matrix" | "string"; result?: undefined };
};
