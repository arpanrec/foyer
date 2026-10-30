// Prometheus metrics the proxy picks out of the plain-text response
export type WatchtowerMetrics = {
    watchtower_containers_scanned?: string;
    watchtower_containers_updated?: string;
    watchtower_containers_failed?: string;
};
