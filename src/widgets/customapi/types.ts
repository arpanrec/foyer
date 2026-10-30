// A path into the response: a dotted string, or a legacy nested object such as `{ stats: "cpu" }`
export type CustomapiField = string | { [key: string]: CustomapiField } | undefined;

type CustomapiRemap = {
    any?: boolean;
    value?: unknown;
    to?: string | number | boolean | null;
};

// How a value is remapped, scaled and formatted
export type CustomapiFormat = {
    remap?: CustomapiRemap[];
    scale?: number | string;
    format?: string;
    locale?: string;
    dateStyle?: string;
    timeStyle?: string;
    style?: string;
    numeric?: string;
    prefix?: string;
    suffix?: string;
    [option: string]: unknown;
};

export type CustomapiAdditionalField = CustomapiFormat & {
    field?: CustomapiField;
    color?: string;
};

// A mapping of the block and list displays
export type CustomapiMapping = CustomapiFormat & {
    label?: string;
    field?: CustomapiField;
    additionalField?: CustomapiAdditionalField;
};

// The mappings of the dynamic-list display
export type CustomapiListMappings = CustomapiFormat & {
    items?: string;
    name?: string;
    label?: string;
    target?: string;
    limit?: number | string;
};

export type CustomapiOptions = {
    mappings?: CustomapiMapping[] | CustomapiListMappings;
    display?: string;
};

export type Translate = (key: string, options: Record<string, unknown>) => string;
