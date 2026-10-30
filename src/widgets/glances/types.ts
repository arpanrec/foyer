import type { WidgetProps } from "@/types/service";

export type GlancesOptions = {
    metric?: string;
    chart?: boolean;
    refreshInterval?: number;
    pointsLimit?: number;
    version?: number;
    diskUnits?: string;
    hideErrors?: boolean;
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
    Id?: string;
    id?: string;
    Status?: string;
    status?: string;
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
    cpu_name?: string;
    cpu?: number | null;
    mem?: number;
    swap?: number;
    percpu?: { total: number }[];
    error?: unknown;
};

export type GlancesSystemResponse = {
    linux_distro?: string;
    os_version?: string;
    hostname?: string;
};

export type GlancesDiskDataPoint = {
    read_bytes: number;
    write_bytes: number;
    time_since_update: number;
};

export type GlancesDiskIo = GlancesDiskDataPoint & {
    disk_name: string;
    critical?: number;
};

export type GlancesFsItem = {
    key: string;
    size: number;
    free: number;
    used?: number;
    [key: string]: unknown;
};

export type GlancesGpuItem = {
    key: string;
    mem: number;
    proc: number;
    name?: string;
    temperature: number;
    [key: string]: unknown;
};

export type GlancesMemoryResponse = {
    used: number;
    available?: number;
    total?: number;
};

export type GlancesNetInterface = {
    key: string;
    interface_name?: string;
    rx?: number;
    bytes_recv?: number;
    tx?: number;
    bytes_sent?: number;
    time_since_update: number;
    [key: string]: unknown;
};

export type GlancesProcess = {
    pid: number;
    status: string;
    name: string;
    cpu_percent: number;
    memory_info: {
        0?: number;
        rss?: number;
        data?: number;
        wset?: number;
    };
};

export type GlancesSensor = {
    label: string;
    value: number;
    unit: string;
    warning?: number;
    critical?: number;
};
