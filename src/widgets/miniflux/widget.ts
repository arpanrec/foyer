import { asJson } from "@/utils/proxy/api-helpers";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
import type { MinifluxCounters, MinifluxRawCounters } from "@/widgets/miniflux/types";

const widget = {
    api: "{url}/v1/{endpoint}",
    proxyHandler: credentialedProxyHandler,

    mappings: {
        counters: {
            endpoint: "feeds/counters",
            map: (data: unknown): MinifluxCounters => {
                const { reads, unreads } = asJson<MinifluxRawCounters>(data);
                return {
                    read: Object.values<number>(reads).reduce((acc, i) => acc + i, 0),
                    unread: Object.values<number>(unreads).reduce((acc, i) => acc + i, 0),
                };
            },
        },
    },
};

export default widget;
