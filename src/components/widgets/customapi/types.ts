import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

// A displayed value; the remap, scale and format fields are read by `formatValue` in `widgets/customapi/utils`
export type CustomApiMapping = {
    label: string;
    field?: unknown;
    [option: string]: unknown;
};

export type CustomApiOptions = InfoWidgetBaseOptions & {
    icon?: string;
    mappings?: CustomApiMapping[];
    refreshInterval?: number;
};
