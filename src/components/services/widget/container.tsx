import { useContext, useMemo, type ReactElement, type ReactNode } from "react";

import Error from "@/components/services/widget/error";
import { BlockHighlightContext } from "@/components/services/widget/highlight-context";
import type { Service } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";
import { buildHighlightConfig } from "@/utils/highlights";

const ALIASED_WIDGETS: Record<string, string> = {
    pialert: "netalertx",
    hoarder: "karakeep",
    jellyseerr: "seerr",
    overseerr: "seerr",
};

type ContainerProps = {
    error?: unknown;
    children?: ReactNode;
    service?: Service;
};

export default function Container({ error = false, children, service }: ContainerProps) {
    const { settings } = useContext(SettingsContext);

    const highlightConfig = useMemo(
        () => buildHighlightConfig(settings?.blockHighlights, service?.widget?.highlight, service?.widget?.type),
        [settings?.blockHighlights, service?.widget?.highlight, service?.widget?.type]
    );

    if (error) {
        if (settings.hideErrors || service?.widget?.hide_errors) {
            return null;
        }

        return <Error service={service} error={error} />;
    }

    const childrenArray = (Array.isArray(children) ? children : [children]) as ReactElement<{
        field?: string;
        label?: string;
    }>[];

    let visibleChildren = childrenArray;
    // labels and annotations carry the fields as JSON text
    const configuredFields: unknown = service?.widget?.fields;
    const fields: string[] | null | undefined =
        typeof configuredFields === "string" ? JSON.parse(configuredFields) : service?.widget?.fields;
    const type = service?.widget?.type;
    if (fields && type) {
        // if the field contains a "." then it most likely contains a common loc value
        // logic now allows a fields array that can look like:
        // fields: [ "resources.cpu", "resources.mem", "field"]
        // or even
        // fields: [ "resources.cpu", "widget_type.field" ]
        visibleChildren = childrenArray?.filter((child) =>
            fields.some((field) => {
                let fullField = field;
                if (!field.includes(".")) {
                    fullField = `${type}.${field}`;
                }
                let matches = fullField === (child?.props?.field || child?.props?.label);
                // check if the field is an 'alias'
                if (matches) {
                    return true;
                } else if (ALIASED_WIDGETS[type]) {
                    matches =
                        fullField.replace(type, ALIASED_WIDGETS[type]) === (child?.props?.field || child?.props?.label);

                    return matches;
                }
                // no match
                return false;
            })
        );
    }
    const content = <div className="relative flex flex-row w-full service-container">{visibleChildren}</div>;

    if (!highlightConfig) {
        return content;
    }

    return <BlockHighlightContext.Provider value={highlightConfig}>{content}</BlockHighlightContext.Provider>;
}
