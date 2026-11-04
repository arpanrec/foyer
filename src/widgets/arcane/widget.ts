import { asJson } from "@/utils/proxy/api-helpers";
import credentialedProxyHandler from "@/utils/proxy/handlers/credentialed";
import type {
    ArcaneContainerCounts,
    ArcaneEnvelope,
    ArcaneImageCounts,
    ArcaneUpdateSummary,
} from "@/widgets/arcane/types";

const widget = {
    api: "{url}/api/{endpoint}",
    proxyHandler: credentialedProxyHandler,

    mappings: {
        containers: {
            endpoint: "environments/{env}/containers/counts",
            map: (data: unknown) => asJson<ArcaneEnvelope<ArcaneContainerCounts>>(data).data,
        },
        images: {
            endpoint: "environments/{env}/images/counts",
            map: (data: unknown) => asJson<ArcaneEnvelope<ArcaneImageCounts>>(data).data,
        },
        updates: {
            endpoint: "environments/{env}/image-updates/summary",
            map: (data: unknown) => asJson<ArcaneEnvelope<ArcaneUpdateSummary>>(data).data,
        },
    },
};

export default widget;
