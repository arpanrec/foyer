import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import ErrorBoundary from "@/components/errorboundry";
import type { InfoWidgetEntry, InfoWidgetProps, InfoWidgetStyle } from "@/components/widgets/widget/types";

// Every widget takes its own options type; the options come from widgets.yaml, so they are only known at run time
const widgetMappings: Record<string, ComponentType<InfoWidgetProps>> = {
    weatherapi: dynamic(() => import("@/components/widgets/weather/weather")),
    openweathermap: dynamic(() => import("@/components/widgets/openweathermap/weather")),
    resources: dynamic(() => import("@/components/widgets/resources/resources")),
    search: dynamic(() => import("@/components/widgets/search/search")),
    greeting: dynamic(() => import("@/components/widgets/greeting/greeting")),
    datetime: dynamic(() => import("@/components/widgets/datetime/datetime")),
    logo: dynamic(() => import("@/components/widgets/logo/logo"), { ssr: false }),
    unifi_console: dynamic(() => import("@/components/widgets/unifi_console/unifi_console")),
    glances: dynamic(() => import("@/components/widgets/glances/glances")),
    openmeteo: dynamic(() => import("@/components/widgets/openmeteo/openmeteo")),
    longhorn: dynamic(() => import("@/components/widgets/longhorn/longhorn")),
    kubernetes: dynamic(() => import("@/components/widgets/kubernetes/kubernetes")),
    stocks: dynamic(() => import("@/components/widgets/stocks/stocks")),
    customapi: dynamic(() => import("@/components/widgets/customapi/customapi")),
};

type WidgetProps = {
    widget: InfoWidgetEntry;
    style: InfoWidgetStyle;
};

export default function Widget({ widget, style }: WidgetProps) {
    const InfoWidget = widgetMappings[widget.type];

    if (InfoWidget) {
        return (
            <ErrorBoundary>
                <InfoWidget options={{ ...widget.options, style }} />
            </ErrorBoundary>
        );
    }

    return (
        <div className="flex-none flex flex-row items-center justify-center">
            Missing <strong>{widget.type}</strong>
        </div>
    );
}
