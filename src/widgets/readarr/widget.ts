import { jsonArrayFilter } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import type { ReadarrBook } from "@/widgets/readarr/types";

const widget = {
    api: "{url}/api/v1/{endpoint}?apikey={key}",
    proxyHandler: genericProxyHandler,

    mappings: {
        book: {
            endpoint: "book",
            map: (data: unknown) => ({
                have: jsonArrayFilter<ReadarrBook>(data, (item) => (item?.statistics?.bookFileCount ?? 0) > 0).length,
            }),
        },
        "queue/status": {
            endpoint: "queue/status",
        },
        "wanted/missing": {
            endpoint: "wanted/missing",
        },
        calendar: {
            endpoint: "calendar",
            params: ["start", "end", "unmonitored", "includeAuthor"],
        },
    },
};

export default widget;
