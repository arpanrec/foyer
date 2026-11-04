import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type DateTimeOptions = InfoWidgetBaseOptions & {
    text_size?: string;
    locale?: string;
    format?: Intl.DateTimeFormatOptions;
};
