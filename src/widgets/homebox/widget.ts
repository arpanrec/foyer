import type { WidgetDefinition } from "@/types/widget-definition";
import homeboxProxyHandler from "@/widgets/homebox/proxy";

const widget = {
    proxyHandler: homeboxProxyHandler,
} satisfies WidgetDefinition;

export default widget;
