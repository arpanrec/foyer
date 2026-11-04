import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import cache from "@/utils/cache";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import { xmlToCompact } from "@/utils/xml";
import type { PlexApiData, PlexLibrary } from "@/widgets/plex/types";
import widgets from "@/widgets/widgets";

const proxyName = "plexProxyHandler";
const librariesCacheKey = `${proxyName}__libraries`;
const countsCacheKey = `${proxyName}__counts`;

type PlexCounts = { albums: number; movies: number; tv: number };
const logger = createLogger(proxyName);

async function getWidget(req: ApiRequest) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.warn("Invalid or missing service '%s' or group '%s'", service, group);
        return null;
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.warn("Invalid or missing widget for service '%s' in group '%s'", service, group);
        return null;
    }

    return widget;
}

// [status, decoded body (null on failure), raw body, content type]
async function fetchFromPlexAPI(
    endpoint: string,
    widget: WidgetConfig
): Promise<[number, PlexApiData | null, string?, (string | undefined)?]> {
    const api = widgets?.[widget.type]?.api;
    if (!api) {
        return [403, null, ""];
    }

    const url = new URL(formatApiCall(api, { endpoint, ...widget }));

    const [status, contentType, data] = await httpProxy(url, {
        headers: {
            "X-Plex-Container-Start": `0`,
            "X-Plex-Container-Size": `500`,
        },
    });

    if (status !== 200) {
        logger.error("HTTP %d communicating with Plex. Data: %s", status, String(data));
        return [status, null, String(data)];
    }

    try {
        return [status, xmlToCompact(String(data)) as unknown as PlexApiData, String(data), contentType];
    } catch (e) {
        logger.error("Error decoding Plex API data. Data: %s", String(data));
        return [status, null, String(data)];
    }
}

export default async function plexProxyHandler(req: ApiRequest, res: ApiResponse) {
    const widget = await getWidget(req);

    const { service, index } = req.query;

    if (!widget) {
        // the widget lookup has logged why
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    logger.debug("Getting streams from Plex API");
    let streams: string | undefined;
    let [status, apiData, rawData] = await fetchFromPlexAPI("/status/sessions", widget);

    if (status !== 200) {
        return res.status(status).json({ error: { message: "HTTP error communicating with Plex API", data: rawData } });
    }

    if (apiData && apiData.MediaContainer) {
        streams = apiData.MediaContainer._attributes["size"];
    }

    const libraries = await cache.getOrFetch<PlexLibrary[]>(
        `${librariesCacheKey}.${service}.${index}`,
        async () => {
            logger.debug("Getting libraries from Plex API");
            [status, apiData] = await fetchFromPlexAPI("/library/sections", widget);
            if (!apiData || !apiData.MediaContainer) return undefined;
            return ([] as PlexLibrary[]).concat(apiData.MediaContainer.Directory ?? []);
        },
        { type: "response", ttlMs: 1000 * 60 * 60 * 6 }
    );

    const { albums, movies, tv } = (await cache.getOrFetch<PlexCounts>(
        `${countsCacheKey}.${service}.${index}`,
        async () => {
            const counts: PlexCounts = { albums: 0, movies: 0, tv: 0 };
            logger.debug("Getting counts from Plex API");
            const movieTVLibraries = (libraries ?? []).filter((l) =>
                ["movie", "show", "artist"].includes(l._attributes.type)
            );
            await Promise.all(
                movieTVLibraries.map(async (library) => {
                    const libraryURL = ["movie", "show"].includes(library._attributes.type)
                        ? `/library/sections/${library._attributes.key}/all` // tv + movies
                        : `/library/sections/${library._attributes.key}/albums`; // music
                    [status, apiData] = await fetchFromPlexAPI(libraryURL, widget);
                    if (apiData && apiData.MediaContainer) {
                        const sizeProp = apiData.MediaContainer._attributes["totalSize"] ? "totalSize" : "size";
                        const size = parseInt(apiData.MediaContainer._attributes[sizeProp] ?? "", 10);
                        if (library._attributes.type === "movie") {
                            counts.movies += size;
                        } else if (library._attributes.type === "show") {
                            counts.tv += size;
                        } else if (library._attributes.type === "artist") {
                            counts.albums += size;
                        }
                    }
                })
            );
            return counts;
        },
        { type: "response", ttlMs: 1000 * 60 * 10 }
    )) ?? { albums: 0, movies: 0, tv: 0 };

    const data = {
        streams,
        albums,
        movies,
        tv,
    };

    return res.status(status).send(data);
}
