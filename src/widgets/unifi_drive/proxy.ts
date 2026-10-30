import type { ApiRequest } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import type createLogger from "@/utils/logger";
import createUnifiProxyHandler from "@/utils/proxy/handlers/unifi";
import { httpProxy } from "@/utils/proxy/http";

type Logger = ReturnType<typeof createLogger>;

const drivePrefix = "/proxy/drive";

async function getWidget(req: ApiRequest, logger: Logger): Promise<WidgetConfig | null> {
    const { group, service, index } = req.query;
    if (!group || !service) return null;

    const widget = await getServiceWidget(group, service, index);
    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return null;
    }
    return widget;
}

async function resolveRequestContext({ cachedPrefix, widget }: { cachedPrefix: string | null; widget: WidgetConfig }) {
    if (cachedPrefix !== null) {
        return { prefix: cachedPrefix };
    }

    if (!widget.url) {
        throw new Error("Widget url is not configured");
    }

    const [, , , responseHeaders] = await httpProxy(widget.url);

    return {
        prefix: drivePrefix,
        csrfToken: responseHeaders?.["x-csrf-token"],
    };
}

export default createUnifiProxyHandler({
    proxyName: "unifiDriveProxyHandler",
    resolveWidget: getWidget,
    resolveRequestContext,
});
