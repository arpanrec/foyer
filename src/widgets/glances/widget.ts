import type { WidgetDefinition } from "@/types/widget-definition";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";

const widget = {
    api: "{url}/api/{endpoint}",
    proxyHandler: credentialedProxyHandler,
    allowedEndpoints: /^\d+\/(quicklook|diskio|cpu|fs|gpu|system|mem|network|processlist|sensors|containers)$/,
} satisfies WidgetDefinition;

export default widget;
