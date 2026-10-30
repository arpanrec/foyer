import cache from "memory-cache";

import type { ApiRequest, ApiResponse } from "@/types/api";
import type { WidgetConfig } from "@/types/service";
import getServiceWidget from "@/utils/config/service-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import type { Release, ReleaseRepository, ReleaseServiceConfig, ReleasesOptions } from "@/widgets/releases/types";
import { parseRepository, parseServicesConfig, services } from "@/widgets/releases/utils";

const logger = createLogger("releasesProxyHandler");
const CACHE_MS = 2 * 60 * 60 * 1000;

async function fetchRelease(request: ReleaseRepository, { endpoint, token }: ReleaseServiceConfig): Promise<Release> {
    const cacheKey = `releases:${request.service}:${endpoint}:${request.repo}:${request.includePrereleases}`;
    const cached: Release | null = cache.get(cacheKey);
    if (cached) return cached;

    const service = services[request.service];
    const [status, , data] = await httpProxy(service.url({ ...request, endpoint }), {
        headers: {
            "User-Agent": `foyer/${process.env.NEXT_PUBLIC_VERSION || "dev"}`,
            Accept: "application/json",
            ...service.headers(token),
        },
    });

    if (status !== 200) throw new Error(`HTTP ${status}`);

    const release = {
        source: request.service,
        ...service.toRelease(JSON.parse(Buffer.from(data as Buffer).toString()), request),
    };
    // only successful fetches are cached
    cache.put(cacheKey, release, CACHE_MS);
    return release;
}

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
        return res.status(400).json({ error: errorMessage(e) });
    }

    const results = await Promise.allSettled(requests.map((request) => fetchRelease(request, config[request.service])));

    const releases: Release[] = [];
    results.forEach((result, i) => {
        if (result.status === "fulfilled") {
            releases.push(result.value);
        } else {
            logger.error("Failed to fetch %s release for %s: %s", requests[i].service, requests[i].repo, result.reason);
        }
    });

    if (!releases.length) {
        return res.status(500).json({ error: { message: "Unable to fetch any releases" } });
    }

    releases.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    const limit = parseInt(String(options?.limit), 10);
    return res.status(200).json({
        releases: releases.slice(0, limit > 0 ? limit : 10),
        failed: requests.length - releases.length,
    });
}
