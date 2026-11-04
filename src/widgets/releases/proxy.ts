import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import cache from "@/utils/cache";
import getServiceWidget from "@/utils/config/service-helpers";
import { byDateDesc } from "@/utils/dates";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import { foyerUserAgent } from "@/utils/proxy/user-agent";
import type {
    FailedRelease,
    Release,
    ReleaseRepository,
    ReleaseServiceConfig,
    ReleasesOptions,
} from "@/widgets/releases/types";
import { parseRepository, parseServicesConfig, services, type ReleaseService } from "@/widgets/releases/utils";

const logger = createLogger("releasesProxyHandler");
const CACHE_MS = 2 * 60 * 60 * 1000;
// A failure is kept for about one widget refresh, so a repository that keeps failing costs one upstream request per
// interval however many clients ask (GitHub allows 60 unauthenticated requests an hour), and a transient error still
// clears quickly
const FAILURE_CACHE_MS = 10 * 60 * 1000;

type CacheEntry = { release: Release } | { error: string };

// A failure served from the cache, which the handler does not log again as an upstream error
class CachedFailure extends Error {}

/**
 * Asks a release service for the latest release.
 *
 * @param service The release service definition.
 * @param request The repository to look up.
 * @param config The service endpoint and token.
 * @returns The release.
 */
async function requestRelease(
    service: ReleaseService,
    request: ReleaseRepository,
    { endpoint, token }: ReleaseServiceConfig
): Promise<Release> {
    const url = service.url({ ...request, endpoint });
    const [status, , data] = await httpProxy(url, {
        headers: {
            "User-Agent": foyerUserAgent(url),
            Accept: "application/json",
            ...service.headers(token),
        },
    });

    if (status !== 200) throw new Error(`HTTP ${status}`);

    return {
        source: request.service,
        ...service.toRelease(JSON.parse(Buffer.from(data as Buffer).toString()), request),
    };
}

/**
 * Returns the latest release of a repository from the cache, a running lookup, or a new upstream call, so concurrent requests share one call.
 *
 * @param request The repository to look up.
 * @param config The service endpoint and token.
 * @returns The release.
 */
async function fetchRelease(request: ReleaseRepository, config: ReleaseServiceConfig): Promise<Release> {
    const service = services[request.service];
    if (!service) throw new Error(`Unknown release service ${request.service}`);

    const cacheKey = `releases:${request.service}:${config.endpoint}:${request.repo}:${request.includePrereleases}`;
    // A failure is cached too, for a shorter time. Concurrent requests share one upstream call.
    let rawError: unknown;
    const entry = await cache.getOrFetch<CacheEntry>(
        cacheKey,
        async () => {
            try {
                return { release: await requestRelease(service, request, config) };
            } catch (e) {
                rawError = e;
                return { error: errorMessage(e) ?? String(e) };
            }
        },
        { type: "response", ttlMs: (value) => ("error" in value ? FAILURE_CACHE_MS : CACHE_MS) }
    );

    if (!entry) throw new Error(`No release for ${request.repo}`);
    if ("error" in entry) {
        // the request that made the call reports its own error; later ones report the cached message
        throw rawError ?? new CachedFailure(entry.error);
    }
    return entry.release;
}

/**
 * Answers a releases widget request with the latest release of each configured repository.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
export default async function releasesProxyHandler(req: ApiRequest, res: ApiResponse) {
    const { group, service, index } = req.query as Record<string, string>;
    const widget = await getServiceWidget(group, service, index);
    const options = widget as (WidgetConfig & ReleasesOptions) | undefined;

    let requests: ReturnType<typeof parseRepository>[];
    let config: ReturnType<typeof parseServicesConfig>;
    try {
        const entries = options?.repositories;
        if (!Array.isArray(entries) || !entries.length) {
            throw new Error("repositories must be a non-empty list of { service, repo }");
        }
        config = parseServicesConfig(options?.servicesConfig);
        requests = entries.map((entry) => parseRepository(entry, options?.includePrereleases));
        const seen = new Set<string>();
        requests.forEach(({ service: source, repo }) => {
            const id = `${source}:${repo}`;
            if (seen.has(id)) throw new Error(`Duplicate repository in repositories: ${id}`);
            seen.add(id);
        });
    } catch (e) {
        logger.warn("Invalid releases options for service '%s' in group '%s': %s", service, group, errorMessage(e));
        return res.status(400).json({ error: errorMessage(e) });
    }

    const results = await Promise.allSettled(
        requests.map((request) => {
            const serviceConfig = config[request.service];
            return serviceConfig
                ? fetchRelease(request, serviceConfig)
                : Promise.reject(new Error(`No configuration for release service ${request.service}`));
        })
    );

    const releases: Release[] = [];
    const failures: FailedRelease[] = [];
    results.forEach((result, i) => {
        if (result.status === "fulfilled") {
            releases.push(result.value);
        } else {
            // allSettled keeps one result per request, in order
            const { service, repo } = requests[i]!;
            const reason = errorMessage(result.reason) ?? String(result.reason);
            if (result.reason instanceof CachedFailure) {
                logger.debug("Using cached failure for %s release of %s: %s", service, repo, reason);
            } else {
                logger.error("Failed to fetch %s release for %s: %s", service, repo, result.reason);
            }
            failures.push({ service, repo, reason });
        }
    });

    if (!releases.length) {
        return res.status(500).json({ error: { message: "Unable to fetch any releases" } });
    }

    releases.sort(byDateDesc);

    const limit = parseInt(String(options?.limit), 10);
    return res.status(200).json({
        releases: releases.slice(0, limit > 0 ? limit : 10),
        failed: failures.length,
        failures,
    });
}
