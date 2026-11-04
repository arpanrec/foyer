import type { WidgetProps } from "@/types/service";

export type GlancesOptions = {
    metric?: string | undefined;
    chart?: boolean | undefined;
    refreshInterval?: number | undefined;
    pointsLimit?: number | undefined;
    version?: number | undefined;
    diskUnits?: string | undefined;
    hideErrors?: boolean | undefined;
};

export type GlancesMetricProps = WidgetProps<GlancesOptions>;

export type ChartDataPoint = {
    value: number;
};

export type ChartDualDataPoint = {
    a: number;
    b: number;
};

export type GlancesContainer = {
    Id?: string | undefined;
    id?: string | undefined;
    Status?: string | undefined;
    status?: string | undefined;
    name: string;
    cpu_percent: number;
    memory: {
        usage: number;
        inactive_file: number;
    };
};

export type GlancesCpuResponse = {
    total: number;
};

export type GlancesQuicklookResponse = {
    cpu_name?: string | undefined;
    cpu?: number | null | undefined;
    mem?: number | undefined;
    swap?: number | undefined;
    percpu?: { total: number }[];
    error?: unknown;
};

export type GlancesSystemResponse = {
    linux_distro?: string | undefined;
    os_version?: string | undefined;
    hostname?: string | undefined;
};

export type GlancesDiskDataPoint = {
    read_bytes: number;
    write_bytes: number;
    time_since_update: number;
};

export type GlancesDiskIo = GlancesDiskDataPoint & {
    disk_name: string;
    critical?: number | undefined;
};

export type GlancesFsItem = {
    key: string;
    size: number;
    free: number;
    used?: number | undefined;
    [key: string]: unknown;
};

export type GlancesGpuItem = {
    key: string;
    mem: number;
    proc: number;
    name?: string | undefined;
    temperature: number;
    [key: string]: unknown;
};

export type GlancesMemoryResponse = {
    used: number;
    available?: number | undefined;
    total?: number | undefined;
};

export type GlancesNetInterface = {
    key: string;
    interface_name?: string | undefined;
    rx?: number | undefined;
    bytes_recv?: number | undefined;
    tx?: number | undefined;
    bytes_sent?: number | undefined;
    time_since_update: number;
    [key: string]: unknown;
};

export type GlancesProcess = {
    pid: number;
    status: string;
    name: string;
    cpu_percent: number;
    memory_info: {
        0?: number | undefined;
        rss?: number | undefined;
        data?: number | undefined;
        wset?: number | undefined;
    };
};

export type GlancesSensor = {
    label: string;
    value: number;
    unit: string;
    warning?: number | undefined;
    critical?: number | undefined;
};
