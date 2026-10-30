import cache from "memory-cache";
import { xml2json } from "xml-js";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import createLogger from "@/utils/logger";
import { formatApiCall } from "@/utils/proxy/api-helpers";
import { httpProxy } from "@/utils/proxy/http";
import type { PlexApiData, PlexLibrary } from "@/widgets/plex/types";
import widgets from "@/widgets/widgets";

const proxyName = "plexProxyHandler";
const librariesCacheKey = `${proxyName}__libraries`;
const albumsCacheKey = `${proxyName}__albums`;
const moviesCacheKey = `${proxyName}__movies`;
const tvCacheKey = `${proxyName}__tv`;
const logger = createLogger(proxyName);

async function getWidget(req: ApiRequest) {
    const { group, service, index } = req.query;

    if (!group || !service) {
        logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
        return null;
    }

    const widget = await getServiceWidget(group, service, index);

    if (!widget) {
        logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
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
        const dataDecoded = xml2json(String(data), { compact: true });
        return [status, JSON.parse(dataDecoded), String(data), contentType];
    } catch (e) {
        logger.error("Error decoding Plex API data. Data: %s", String(data));
        return [status, null, String(data)];
    }
}

export default async function plexProxyHandler(req: ApiRequest, res: ApiResponse) {
    const widget = await getWidget(req);

    const { service, index } = req.query;

    if (!widget) {
        return res.status(400).json({ error: "Invalid proxy service type" });
    }

    logger.debug("Getting streams from Plex API");
    let streams: string | undefined;
    let [status, apiData, rawData] = await fetchFromPlexAPI("/status/sessions", widget);

    if (status !== 200) {
        return res.status(status).json({ error: { message: "HTTP error communicating with Plex API", data: rawData } });
    }

    if (apiData && apiData.MediaContainer) {
        streams = apiData.MediaContainer._attributes.size;
    }

    let libraries: PlexLibrary[] | null = cache.get(`${librariesCacheKey}.${service}.${index}`);
    if (libraries === null) {
        logger.debug("Getting libraries from Plex API");
        [status, apiData] = await fetchFromPlexAPI("/library/sections", widget);
        if (apiData && apiData.MediaContainer) {
            libraries = ([] as PlexLibrary[]).concat(apiData.MediaContainer.Directory ?? []);
            cache.put(`${librariesCacheKey}.${service}.${index}`, libraries, 1000 * 60 * 60 * 6);
        }
    }

    let albums: number = cache.get(`${albumsCacheKey}.${service}.${index}`);
    let movies: number = cache.get(`${moviesCacheKey}.${service}.${index}`);
    let tv: number = cache.get(`${tvCacheKey}.${service}.${index}`);
    if (albums === null || movies === null || tv === null) {
        albums = 0;
        movies = 0;
        tv = 0;
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
                    const size = parseInt(apiData.MediaContainer._attributes[sizeProp], 10);
                    if (library._attributes.type === "movie") {
                        movies += size;
                    } else if (library._attributes.type === "show") {
                        tv += size;
                    } else if (library._attributes.type === "artist") {
                        albums += size;
                    }
                }
            })
        );
        cache.put(`${albumsCacheKey}.${service}.${index}`, albums, 1000 * 60 * 10);
        cache.put(`${tvCacheKey}.${service}.${index}`, tv, 1000 * 60 * 10);
        cache.put(`${moviesCacheKey}.${service}.${index}`, movies, 1000 * 60 * 10);
    }

    const data = {
        streams,
        albums,
        movies,
        tv,
    };

    return res.status(status).send(data);
}
