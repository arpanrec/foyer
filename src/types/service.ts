import type { JsonValue } from "@/types/json";

// Options differ for every widget type and come from YAML, Docker labels or Kubernetes
// annotations. The fields below are the ones shared code reads for any widget type; a widget
// declares the rest in its own `<Name>Options` type (`widgets/<type>/types.ts`).
export type WidgetConfig = {
    type: string;
    service_name?: string;
    service_group?: string;
    index?: number | string;
    url?: string;
    fields?: string[] | null;
    highlight?: unknown;
    hide_errors?: boolean;
    key?: string;
    username?: string;
    password?: string;
    headers?: Record<string, string>;
    method?: string;
    requestBody?: JsonValue;
    refreshInterval?: number;
    [option: string]: unknown;
};

// Info widget options: the configured keys, with `type` present only when they come from widgets.yaml
export type InfoWidgetOptions = Partial<WidgetConfig>;

export type Service = {
    name?: string;
    type?: string;
    href?: string;
    description?: string;
    icon?: string;
    weight?: number;
    target?: string;
    server?: string;
    container?: string;
    namespace?: string;
    app?: string;
    podSelector?: string;
    ping?: string;
    siteMonitor?: string;
    statusStyle?: string;
    showStats?: boolean;
    proxmox?: { node?: string; vmid?: string | number; type?: string };
    widget?: WidgetConfig;
    widgets?: WidgetConfig[];
    [key: string]: unknown;
};

export type ServiceGroup = {
    name: string;
    type?: string;
    weight?: number;
    services: Service[];
    groups?: ServiceGroup[];
    [key: string]: unknown;
};

export type Settings = {
    title?: string;
    base?: string;
    theme?: string;
    color?: string;
    language?: string;
    background?: string | { image?: string; blur?: string; saturate?: string; brightness?: string; opacity?: number };
    backgroundOpacity?: number;
    cardBlur?: string;
    cardStyle?: string;
    blockStyle?: string;
    blockHighlights?: unknown;
    bookmarksStyle?: string;
    headerStyle?: string;
    iconStyle?: string;
    statusStyle?: string;
    layout?: Record<string, Record<string, unknown> | undefined>;
    providers?: Record<string, unknown>;
    quicklaunch?: Record<string, unknown>;
    currency?: string;
    baseCurrency?: string;
    target?: string;
    startUrl?: string;
    logpath?: string;
    hideErrors?: boolean;
    hideVersion?: boolean;
    disableCollapse?: boolean;
    disableIndexing?: boolean;
    fiveColumns?: boolean;
    fullWidth?: boolean;
    groupsInitiallyCollapsed?: boolean;
    useEqualHeights?: boolean;
    showStats?: boolean;
    maxBookmarkGroupColumns?: number;
    maxGroupColumns?: number;
    metrics?: unknown;
    pwa?: Record<string, unknown>;
    [key: string]: unknown;
};

// A service whose widget is known to exist, as every widget component receives it
export type WidgetService<O extends object = object> = Service & { widget: WidgetConfig & O };

// What `withWidgetFields` returns: the configured fields, or the widget's defaults
export type WidgetServiceWithFields<O extends object = object> = WidgetService<O> & { widget: { fields: string[] } };

// Props of every service widget component
export type WidgetProps<O extends object = object> = {
    service: WidgetService<O>;
};
