import type { InfoWidgetOptions } from "@/types/service";

// Layout hints that the dashboard passes to every information widget
export type InfoWidgetStyle = {
    header?: string | undefined;
    cardBlur?: string | undefined;
    isRightAligned?: boolean | undefined;
};

// The options every information widget container reads, on top of the ones a widget declares itself
export type InfoWidgetBaseOptions = InfoWidgetOptions & {
    style?: InfoWidgetStyle | undefined;
    href?: string | undefined;
    target?: string | undefined;
    label?: string | undefined;
    expanded?: boolean | undefined;
};

// An entry of `/api/widgets`: the widget type and its options from the widgets config
export type InfoWidgetEntry = {
    type: string;
    options: InfoWidgetOptions;
};

export type InfoWidgetProps<O extends InfoWidgetBaseOptions = InfoWidgetBaseOptions> = {
    options: O;
};
