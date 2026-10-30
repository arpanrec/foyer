import type { WidgetDefinition } from "@/types/widget-definition";
import homeassistantProxyHandler from "@/widgets/homeassistant/proxy";

const widget = {
    proxyHandler: homeassistantProxyHandler,
} satisfies WidgetDefinition;

export default widget;
