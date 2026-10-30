import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import type { ReactNode } from "react";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import * as shvl from "@/utils/config/shvl";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { CustomapiListMappings, CustomapiOptions } from "@/widgets/customapi/types";
import { formatValue, getColor, getValue } from "@/widgets/customapi/utils";

export default function Component({ service }: WidgetProps<CustomapiOptions>) {
    const { t } = useTranslation();

    const { widget } = service;

    const { mappings = [], refreshInterval = 10000, display = "block" } = widget;
    const { data: customData, error: customError } = useWidgetAPI<unknown>(widget, null, {
        refreshInterval: Math.max(1000, refreshInterval),
    });

    // the block and list displays take an array of mappings, the dynamic-list display an object
    const blockMappings = Array.isArray(mappings) ? mappings : [];
    const listMappings: CustomapiListMappings = Array.isArray(mappings) ? {} : mappings;

    // if mappings includes an error field and the data contains an error field then show data even if there is an error
    const mappingsIncludesError = blockMappings.find((mapping) => mapping.field === "error");
    const errorIsData = customData && typeof customData === "object" && "error" in customData;

    if (customError && !(mappingsIncludesError && errorIsData)) {
        return <Container service={service} error={customError} />;
    }

    if (!customData) {
        switch (display) {
            case "dynamic-list":
                return (
                    <Container service={service}>
                        <div className="flex flex-col w-full">
                            <div className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs animate-pulse">
                                <div className="font-thin pl-2">Loading...</div>
                            </div>
                        </div>
                    </Container>
                );
            case "list":
                return (
                    <Container service={service}>
                        <div className="flex flex-col w-full">
                            {blockMappings.map((mapping) => (
                                <div
                                    key={mapping.label}
                                    className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs animate-pulse"
                                >
                                    <div className="font-thin pl-2">{mapping.label}</div>
                                    <div className="flex flex-row text-right">
                                        <div className="font-bold mr-2">-</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Container>
                );

            default:
                return (
                    <Container service={service}>
                        {blockMappings.slice(0, 4).map((item) => (
                            <Block label={item.label} key={item.label} />
                        ))}
                    </Container>
                );
        }
    }

    switch (display) {
        case "dynamic-list":
            let listItems: unknown = customData;
            if (listMappings.items) listItems = shvl.get(customData, listMappings.items, null);
            let error;
            if (!listItems || !Array.isArray(listItems)) {
                error = { message: "Unable to find items" };
            }
            const name = listMappings.name;
            const label = listMappings.label;
            if (!name || !label) {
                error = { message: "Name and label properties are required" };
            }
            if (error || !name || !label || !Array.isArray(listItems)) {
                return <Container service={service} error={error}></Container>;
            }

            const target = listMappings.target;
            if (listMappings.limit && parseInt(String(listMappings.limit), 10) > 0) {
                listItems.splice(Number(listMappings.limit));
            }

            return (
                <Container service={service}>
                    <div className="flex flex-col w-full">
                        {listItems.length === 0 ? (
                            <div className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs">
                                <div className="font-thin pl-2">No items found</div>
                            </div>
                        ) : (
                            listItems.map((item: Record<string, unknown>, index) => {
                                const itemName = shvl.get<ReactNode>(item, name, item[name] as ReactNode) ?? "";
                                const itemLabel = shvl.get(item, label, item[label]) ?? "";

                                const itemUrl = target
                                    ? [...target.matchAll(/\{(.*?)\}/g)]
                                          .map((match) => match[1])
                                          .reduce((url, targetTemplate) => {
                                              const value = shvl.get(item, targetTemplate, item[targetTemplate]) ?? "";
                                              return url.replaceAll(`{${targetTemplate}}`, String(value));
                                          }, target)
                                    : null;
                                const className =
                                    "bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs";

                                return itemUrl ? (
                                    <a
                                        key={`${itemName}-${index}`}
                                        className={classNames(
                                            className,
                                            "hover:bg-theme-300/50 dark:hover:bg-theme-800/20"
                                        )}
                                        href={itemUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <div className="font-thin pl-2">{itemName}</div>
                                        <div className="flex flex-row text-right">
                                            <div className="font-bold mr-2">
                                                {formatValue(t, listMappings, itemLabel)}
                                            </div>
                                        </div>
                                    </a>
                                ) : (
                                    <div key={`${itemName}-${index}`} className={className}>
                                        <div className="font-thin pl-2">{itemName}</div>
                                        <div className="flex flex-row text-right">
                                            <div className="font-bold mr-2">
                                                {formatValue(t, listMappings, itemLabel)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Container>
            );
        case "list":
            return (
                <Container service={service}>
                    <div className="flex flex-col w-full">
                        {blockMappings.map((mapping) => (
                            <div
                                key={mapping.label}
                                className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs"
                            >
                                <div className="font-thin pl-2">{mapping.label}</div>
                                <div className="flex flex-row text-right">
                                    <div className="font-bold mr-2">
                                        {formatValue(t, mapping, getValue(mapping.field, customData))}
                                    </div>
                                    {mapping.additionalField && (
                                        <div className={`font-bold mr-2 ${getColor(mapping, customData)}`}>
                                            {formatValue(
                                                t,
                                                mapping.additionalField,
                                                getValue(mapping.additionalField.field, customData)
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Container>
            );

        default:
            return (
                <Container service={service}>
                    {blockMappings.slice(0, 4).map((mapping) => (
                        <Block
                            label={mapping.label}
                            key={mapping.label}
                            value={formatValue(t, mapping, getValue(mapping.field, customData))}
                        />
                    ))}
                </Container>
            );
    }
}
