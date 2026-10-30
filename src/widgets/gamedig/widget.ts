import type { WidgetDefinition } from "@/types/widget-definition";
import gamedigProxyHandler from "@/widgets/gamedig/proxy";

const widget = {
    proxyHandler: gamedigProxyHandler,
    allowedEndpoints: /status/,
} satisfies WidgetDefinition;

export default widget;
