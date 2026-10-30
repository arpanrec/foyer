import type { InfoWidgetOptions } from "@/types/service";

// Layout hints that the dashboard passes to every information widget
export type InfoWidgetStyle = {
    header?: string;
    cardBlur?: string;
    isRightAligned?: boolean;
};

// The options every information widget container reads, on top of the ones a widget declares itself
export type InfoWidgetBaseOptions = InfoWidgetOptions & {
    style?: InfoWidgetStyle;
    href?: string;
    target?: string;
    label?: string;
    expanded?: boolean;
};

// An entry of `/api/widgets`: the widget type and its options from widgets.yaml
export type InfoWidgetEntry = {
    type: string;
    options: InfoWidgetOptions;
};

export type InfoWidgetProps<O extends InfoWidgetBaseOptions = InfoWidgetBaseOptions> = {
    options: O;
};
