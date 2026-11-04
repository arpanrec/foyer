// A path into the response: a dotted string, or a legacy nested object such as `{ stats: "cpu" }`
export type CustomapiField = string | { [key: string]: CustomapiField } | undefined;

type CustomapiRemap = {
    any?: boolean | undefined;
    value?: unknown;
    to?: string | number | boolean | null | undefined;
};

// How a value is remapped, scaled and formatted
export type CustomapiFormat = {
    remap?: CustomapiRemap[] | undefined;
    scale?: number | string | undefined;
    format?: string | undefined;
    locale?: string | undefined;
    dateStyle?: string | undefined;
    timeStyle?: string | undefined;
    style?: string | undefined;
    numeric?: string | undefined;
    prefix?: string | undefined;
    suffix?: string | undefined;
    [option: string]: unknown;
};

export type CustomapiAdditionalField = CustomapiFormat & {
    field?: CustomapiField | undefined;
    color?: string | undefined;
};

// A mapping of the block and list displays
export type CustomapiMapping = CustomapiFormat & {
    label?: string | undefined;
    field?: CustomapiField | undefined;
    additionalField?: CustomapiAdditionalField | undefined;
};

// The mappings of the dynamic-list display
export type CustomapiListMappings = CustomapiFormat & {
    items?: string | undefined;
    name?: string | undefined;
    label?: string | undefined;
    target?: string | undefined;
    limit?: number | string | undefined;
};

export type CustomapiOptions = {
    mappings?: CustomapiMapping[] | CustomapiListMappings | undefined;
    display?: string | undefined;
};

export type Translate = (key: string, options: Record<string, unknown>) => string;
