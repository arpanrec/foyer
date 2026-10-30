import { asJson } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import type { YourSpotifyCountItem } from "@/widgets/yourspotify/types";

const widget = {
    api: "{url}/spotify/{endpoint}?token={key}",
    proxyHandler: genericProxyHandler,

    mappings: {
        songs: {
            endpoint: "songs_per",
            params: ["start", "timeSplit"],
            map: (data: unknown) => asJson<YourSpotifyCountItem[]>(data)[0]?.count || 0,
        },
        time: {
            endpoint: "time_per",
            params: ["start", "timeSplit"],
            map: (data: unknown) => asJson<YourSpotifyCountItem[]>(data)[0]?.count || 0,
        },
        artists: {
            endpoint: "different_artists_per",
            params: ["start", "timeSplit"],
            map: (data: unknown) => asJson<YourSpotifyCountItem[]>(data)[0]?.artists?.length || 0,
        },
    },
};

export default widget;
