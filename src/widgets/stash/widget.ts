import { asJson } from "@/utils/proxy/api-helpers";
import genericProxyHandler from "@/utils/proxy/handlers/generic";
import type { StashGraphqlResponse } from "@/widgets/stash/types";

const widget = {
    api: "{url}/{endpoint}?apikey={key}",
    proxyHandler: genericProxyHandler,

    mappings: {
        stats: {
            method: "POST",
            endpoint: "graphql",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                query: `{
          stats {
            scene_count
            scenes_size
            scenes_duration
            image_count
            images_size
            gallery_count
            performer_count
            studio_count
            movie_count
            tag_count
            total_o_count
            total_play_duration
            total_play_count
            scenes_played
          }
        }`,
            }),
            map: (data: unknown) => asJson<StashGraphqlResponse>(data).data.stats,
        },
    },
};

export default widget;
