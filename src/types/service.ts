import type { JsonValue } from "@/types/json";

// Options differ for every widget type and come from the services config, Docker labels or Kubernetes
// annotations. The fields below are the ones shared code reads for any widget type; a widget
// declares the rest in its own `<Name>Options` type (`widgets/<type>/types.ts`).
export type WidgetConfig = {
    type: string;
    service_name?: string | undefined;
    service_group?: string | undefined;
    index?: number | string | undefined;
    url?: string | undefined;
    fields?: string[] | null | undefined;
    highlight?: unknown;
    hide_errors?: boolean | undefined;
    key?: string | undefined;
    username?: string | undefined;
    password?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    requestBody?: JsonValue | undefined;
    refreshInterval?: number | undefined;
    [option: string]: unknown;
};

// Info widget options: the configured keys, with `type` present only when they come from the widgets config
export type InfoWidgetOptions = Partial<WidgetConfig>;

export type Service = {
    name?: string | undefined;
    type?: string | undefined;
    href?: string | undefined;
    description?: string | undefined;
    icon?: string | undefined;
    weight?: number | undefined;
    target?: string | undefined;
    server?: string | undefined;
    container?: string | undefined;
    namespace?: string | undefined;
    app?: string | undefined;
    podSelector?: string | undefined;
    ping?: string | undefined;
    siteMonitor?: string | undefined;
    statusStyle?: string | undefined;
    showStats?: boolean | undefined;
    proxmoxNode?: string | undefined;
    proxmoxVMID?: string | number | undefined;
    proxmoxType?: string | undefined;
    widget?: WidgetConfig | undefined;
    widgets?: WidgetConfig[] | undefined;
    [key: string]: unknown;
};

export type ServiceGroup = {
    name: string;
    type?: string | undefined;
    weight?: number | undefined;
    services: Service[];
    groups?: ServiceGroup[] | undefined;
    [key: string]: unknown;
};

export type Settings = {
    title?: string | undefined;
    base?: string | undefined;
    theme?: string | undefined;
    color?: string | undefined;
    language?: string | undefined;
    background?:
        | string
        | {
              image?: string | undefined;
              blur?: string | undefined;
              saturate?: string | number | undefined;
              brightness?: string | number | undefined;
              opacity?: number | undefined;
          };
    backgroundOpacity?: number | undefined;
    cardBlur?: string | undefined;
    cardStyle?: string | undefined;
    blockStyle?: string | undefined;
    blockHighlights?: unknown;
    bookmarksStyle?: string | undefined;
    headerStyle?: string | undefined;
    iconStyle?: string | undefined;
    statusStyle?: string | undefined;
    layout?: Record<string, Record<string, unknown> | null | undefined> | undefined;
    providers?: Record<string, unknown> | undefined;
    quicklaunch?: Record<string, unknown> | undefined;
    currency?: string | undefined;
    baseCurrency?: string | undefined;
    target?: string | undefined;
    startUrl?: string | undefined;
    hideErrors?: boolean | undefined;
    hideVersion?: boolean | undefined;
    disableCollapse?: boolean | undefined;
    disableIndexing?: boolean | undefined;
    fiveColumns?: boolean | undefined;
    fullWidth?: boolean | undefined;
    groupsInitiallyCollapsed?: boolean | undefined;
    useEqualHeights?: boolean | undefined;
    showStats?: boolean | undefined;
    maxBookmarkGroupColumns?: number | undefined;
    maxGroupColumns?: number | undefined;
    metrics?: unknown;
    pwa?: Record<string, unknown> | undefined;
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
