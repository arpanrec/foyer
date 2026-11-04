import type { IncomingHttpHeaders } from "node:http";

import type { WidgetDefinition } from "@/types/widget-definition";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
import type { GiteaTotalCount } from "@/widgets/gitea/types";

// Get total from header to avoid pagination limit
export function totalCount(_data: unknown, headers?: IncomingHttpHeaders | null): GiteaTotalCount {
    const count = parseInt(String(headers?.["x-total-count"]), 10);
    return { count: Number.isNaN(count) ? null : count };
}

const widget = {
    api: "{url}/api/v1/{endpoint}",
    proxyHandler: credentialedProxyHandler,

    mappings: {
        notifications: {
            endpoint: "notifications?limit=1",
            map: totalCount,
        },
        issues: {
            endpoint: "repos/issues/search?type=issues&limit=1",
            map: totalCount,
        },
        pulls: {
            endpoint: "repos/issues/search?type=pulls&limit=1",
            map: totalCount,
        },
        repositories: {
            endpoint: "repos/search?limit=1",
            map: totalCount,
        },
    },
} satisfies WidgetDefinition;

export default widget;
