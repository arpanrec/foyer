// The fields of a container stats sample that the calculations read
export type ContainerStatsSample = {
    cpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number; online_cpus: number };
    precpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number };
    memory_stats: { usage: number; total_inactive_file?: number; stats?: { inactive_file?: number } };
    networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
};

export function calculateCPUPercent(stats: Pick<ContainerStatsSample, "cpu_stats" | "precpu_stats">) {
    let cpuPercent = 0.0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

    if (systemDelta > 0.0 && cpuDelta > 0.0) {
        cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0;
    }

    return Math.round(cpuPercent * 10) / 10;
}

export function calculateUsedMemory(stats: Pick<ContainerStatsSample, "memory_stats">) {
    // see https://github.com/docker/cli/blob/dcc161076861177b5eef6cb321722520db3184e7/cli/command/container/stats_helpers.go#L239
    return (
        stats.memory_stats.usage -
        (stats.memory_stats.total_inactive_file ?? stats.memory_stats.stats?.inactive_file ?? 0)
    );
}

export function calculateThroughput(stats: Pick<ContainerStatsSample, "networks">) {
    let rxBytes = 0;
    let txBytes = 0;
    if (stats.networks?.network) {
        rxBytes = stats.networks?.network.rx_bytes;
        txBytes = stats.networks?.network.tx_bytes;
    } else if (stats.networks && Array.isArray(Object.values(stats.networks))) {
        Object.values(stats.networks).forEach((containerInterface) => {
            rxBytes += containerInterface.rx_bytes;
            txBytes += containerInterface.tx_bytes;
        });
    }
    return { rxBytes, txBytes };
}
