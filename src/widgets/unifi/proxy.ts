import type { ApiRequest } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import type createLogger from "@/utils/logger";
import createUnifiProxyHandler from "@/utils/proxy/handlers/unifi";
import { httpProxy } from "@/utils/proxy/http";

type Logger = ReturnType<typeof createLogger>;

const udmpPrefix = "/proxy/network";

async function getWidget(req: ApiRequest, logger: Logger): Promise<WidgetConfig | null> {
    const { group, service, index } = req.query;

    let widget: WidgetConfig | undefined;
    if (group === "unifi_console" && service === "unifi_console") {
        // info widget
        const infowidgetIndex = req.query?.query ? JSON.parse(String(req.query.query)).index : undefined;
        const options = await getPrivateWidgetOptions("unifi_console", infowidgetIndex);
        if (!options) {
            logger.debug("Error retrieving settings for this Unifi widget");
            return null;
        }
        widget = { ...options, type: "unifi" };
    } else {
        if (!group || !service) {
            logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
            return null;
        }

        widget = await getServiceWidget(group, service, index);

        if (!widget) {
            logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
            return null;
        }
    }

    return widget ?? null;
}

async function resolveRequestContext({ cachedPrefix, widget }: { cachedPrefix: string | null; widget: WidgetConfig }) {
    const headers: Record<string, string> = {};

    if (widget.key) {
        headers["X-API-KEY"] = widget.key;
        headers.Accept = "application/json";
        return { headers, prefix: udmpPrefix };
    }

    if (cachedPrefix !== null) {
        return { headers, prefix: cachedPrefix };
    }

    if (!widget.url) {
        throw new Error("Widget url is not configured");
    }

    const [, , , responseHeaders] = await httpProxy(widget.url);
    let prefix = "";
    let csrfToken;

    if (responseHeaders?.["x-csrf-token"]) {
        prefix = udmpPrefix;
        csrfToken = responseHeaders["x-csrf-token"];
    } else if (
        responseHeaders?.["access-control-expose-headers"] ||
        responseHeaders?.["Access-Control-Expose-Headers"]
    ) {
        prefix = udmpPrefix;
    }

    return { csrfToken, headers, prefix };
}

export default createUnifiProxyHandler({
    proxyName: "unifiProxyHandler",
    resolveWidget: getWidget,
    resolveRequestContext,
    getLoginEndpoint: ({ prefix }) => (prefix === udmpPrefix ? "auth/login" : "login"),
});
