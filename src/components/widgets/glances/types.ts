import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type GlancesOptions = InfoWidgetBaseOptions & {
    cpu?: boolean;
    mem?: boolean;
    cputemp?: boolean;
    uptime?: boolean;
    disk?: string | string[];
    diskUnits?: string;
    units?: string;
    cpuSensorLabel?: string;
};

export type GlancesSensor = {
    label: string;
    type: string;
    value: number;
    warning: number;
};

export type GlancesDisk = {
    mnt_point?: string;
    device_name?: string;
    free: number;
    size: number;
    percent: number;
};

export type GlancesData = {
    error?: unknown;
    cpu: { total: number };
    load: { min15: number };
    mem: { available: number; total: number; percent: number };
    sensors?: GlancesSensor[];
    fs?: GlancesDisk[];
    uptime?: string;
};
