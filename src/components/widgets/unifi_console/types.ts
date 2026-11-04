import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type UnifiConsoleOptions = InfoWidgetBaseOptions & {
    site?: string;
};

export type UnifiConsoleHealth = {
    subsystem?: string;
    status: string;
    gw_name?: string;
    "gw_system-stats"?: { uptime: number };
    num_user?: number;
    num_adopted?: number;
};

export type UnifiConsoleSite = {
    name?: string;
    desc?: string;
    health: UnifiConsoleHealth[];
};

export type UnifiConsoleSites = {
    data: UnifiConsoleSite[];
};
