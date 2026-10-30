import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type ResourcesOptions = InfoWidgetBaseOptions & {
    cpu?: boolean;
    memory?: boolean;
    disk?: boolean | string | string[];
    network?: boolean | string;
    cputemp?: boolean;
    uptime?: boolean;
    units?: string;
    diskUnits?: string;
    tempmin?: number;
    tempmax?: number;
    refresh?: number;
};

export type CpuData = {
    error?: unknown;
    cpu: { usage: number; load: number };
};

export type CpuTempData = {
    error?: unknown;
    cputemp?: { main: number; max: number; cores?: number[] };
};

export type DiskData = {
    error?: unknown;
    drive?: { size: number; available: number };
};

export type MemoryData = {
    error?: unknown;
    memory: { active: number; available: number; total: number };
};

export type NetworkData = {
    error?: unknown;
    network?: { rx_sec: number; tx_sec: number; rx_bytes: number; tx_bytes: number };
};

export type UptimeData = {
    error?: unknown;
    uptime: number;
};
