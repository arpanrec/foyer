import { asJson } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import type { TechnitiumRawStats } from "@/widgets/technitium/types";

const widget = {
    api: "{url}/api/{endpoint}?token={key}&utc=true",
    proxyHandler: genericProxyHandler,
    mappings: {
        stats: {
            endpoint: "dashboard/stats/get",
            validate: ["response", "status"],
            params: ["node", "type"],
            map: (data: unknown) => asJson<TechnitiumRawStats>(data).response?.stats,
        },
    },
};

export default widget;
