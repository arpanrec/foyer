import { asJson } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import type { BazarrWanted } from "@/widgets/bazarr/types";

const widget = {
    api: "{url}/api/{endpoint}/wanted?apikey={key}",
    proxyHandler: genericProxyHandler,

    mappings: {
        movies: {
            endpoint: "movies",
            map: (data: unknown) => ({
                total: asJson<BazarrWanted>(data).total,
            }),
        },
        episodes: {
            endpoint: "episodes",
            map: (data: unknown) => ({
                total: asJson<BazarrWanted>(data).total,
            }),
        },
    },
};

export default widget;
