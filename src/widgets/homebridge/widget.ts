import type { WidgetDefinition } from "@/types/widget-definition";
import homebridgeProxyHandler from "@/widgets/homebridge/proxy";

const widget = {
    api: "{url}/api/{endpoint}",
    proxyHandler: homebridgeProxyHandler,

    mappings: {
        info: {
            endpoint: "/",
        },
    },
} satisfies WidgetDefinition;

export default widget;
