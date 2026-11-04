import { getConfig } from "@/utils/config/store";
import {
    firstEntry,
    type ConfiguredWidget,
    type ConfiguredWidgetOptions,
    type WidgetsConfig,
} from "@/utils/config/types";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

const logger = createLogger("widget-helpers");

export async function widgetsFromConfig(): Promise<ConfiguredWidget[]> {
    const widgets = (await getConfig("widgets")) as WidgetsConfig | undefined;

    if (!widgets) return [];

    // map single-key config objects into easy to consume JS arrays
    // an empty widget object has no type, so it is left out; index stays the position in the config
    const widgetsArray = widgets.flatMap((group, index): ConfiguredWidget[] => {
        const entry = firstEntry(group);
        if (!entry) {
            warnOnce(logger, "Skipping the empty widget at position %d in the widgets config", index);
            return [];
        }
        const [type, options] = entry;
        return [{ type, options: { index, ...options } }];
    });
    return widgetsArray;
}

export async function cleanWidgetGroups(widgets: ConfiguredWidget[]) {
    return widgets.map((widget, index): ConfiguredWidget => {
        const sanitizedOptions: Record<string, unknown> = widget.options;
        const optionKeys = Object.keys(sanitizedOptions);

        // delete private options from the sanitized options
        ["username", "password", "key", "apiKey", "headers", "requestBody", "method"].forEach((pO) => {
            if (optionKeys.includes(pO)) {
                delete sanitizedOptions[pO];
            }
        });

        // delete url from the sanitized options if the widget is not a search or glances widget
        if (widget.type !== "search" && widget.type !== "glances" && optionKeys.includes("url")) {
            delete sanitizedOptions["url"];
        }

        return {
            type: widget.type,
            options: {
                index,
                ...sanitizedOptions,
            },
        };
    });
}

type PrivateWidgetOptions = Pick<
    ConfiguredWidgetOptions,
    "index" | "url" | "username" | "password" | "key" | "apiKey" | "headers" | "requestBody" | "method"
>;

type PrivateWidgetEntry = { type: string; options: PrivateWidgetOptions };

export async function getPrivateWidgetOptions(): Promise<PrivateWidgetEntry[]>;
export async function getPrivateWidgetOptions(
    type: string,
    widgetIndex: string | string[] | number
): Promise<PrivateWidgetOptions | undefined>;
export async function getPrivateWidgetOptions(
    type?: string,
    widgetIndex?: string | string[] | number
): Promise<PrivateWidgetEntry[] | PrivateWidgetOptions | undefined> {
    const widgets = await widgetsFromConfig();

    const privateOptions = widgets.map((widget) => {
        const { index, url, username, password, key, apiKey, headers, requestBody, method } = widget.options;

        return {
            type: widget.type,
            options: {
                index,
                url,
                username,
                password,
                key,
                apiKey,
                headers,
                requestBody,
                method,
            },
        };
    });

    return type !== undefined && widgetIndex !== undefined
        ? privateOptions.find((o) => o.type === type && o.options.index === parseInt(String(widgetIndex), 10))?.options
        : privateOptions;
}
