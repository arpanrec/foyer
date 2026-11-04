import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type LonghornOptions = InfoWidgetBaseOptions & {
    expanded?: boolean | undefined;
    total?: boolean | undefined;
    labels?: boolean | undefined;
    nodes?: boolean | undefined;
    include?: string[] | undefined;
};

export type LonghornNode = {
    id: string;
    available: number;
    maximum: number;
    reserved: number;
    scheduled: number;
};

export type LonghornData = {
    error?: unknown;
    nodes: LonghornNode[];
};

// The part of Longhorn's `/v1/nodes` response that is summed up
export type LonghornApiNodes = {
    data: {
        id: string;
        disks?: Record<
            string,
            { storageAvailable: number; storageMaximum: number; storageReserved: number; storageScheduled: number }
        >;
    }[];
};
