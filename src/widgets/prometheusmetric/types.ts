export type PrometheusMetricFormat = {
    scale?: number | string | undefined;
    type?: string | undefined;
    options?: Record<string, unknown> | undefined;
    prefix?: string | undefined;
    suffix?: string | undefined;
};

export type PrometheusMetric = {
    label: string;
    key?: string | undefined;
    query: string;
    refreshInterval?: number | undefined;
    format?: PrometheusMetricFormat | undefined;
};

export type PrometheusmetricOptions = {
    metrics?: PrometheusMetric[] | undefined;
    refreshInterval?: number | undefined;
};

// [timestamp, value]
export type PrometheusSample = [number, string];

export type PrometheusQueryData = {
    data?:
        | { resultType: "vector"; result?: { value?: PrometheusSample | undefined }[] }
        | { resultType: "scalar"; result?: PrometheusSample | undefined }
        | { resultType: "matrix" | "string"; result?: undefined };
};
