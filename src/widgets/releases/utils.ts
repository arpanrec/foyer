import type {
    ForgejoRelease,
    GithubRelease,
    GitlabRelease,
    ParsedRelease,
    ReleaseRepository,
    ReleaseServiceConfig,
} from "@/widgets/releases/types";

const SEGMENT = /^[\w.-]+$/;
const ENTRY_KEYS = ["repo", "service"];
const SERVICE_CONFIG_KEYS = ["endpoint", "token"];

type PlainObject = Record<string, unknown>;

const isSegment = (value: string) => SEGMENT.test(value) && value !== "." && value !== "..";
const isTrue = (value: unknown) => value === true || value === "true";
const isPlainObject = (value: unknown): value is PlainObject =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnlyKeys = (value: PlainObject, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));

export function normalizeVersion(version: unknown) {
    const normalized = String(version ?? "")
        .trim()
        .toLowerCase();
    return normalized && !normalized.startsWith("v") ? `v${normalized}` : normalized;
}

function parseDate(value: string | undefined) {
    const time = Date.parse(value as string);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function requireTag<T extends { tag_name?: string }>(data: T | undefined): asserts data is T {
    if (!data?.tag_name) throw new Error("No releases found");
}

// endpoint is the API base URL; the default is the public instance
type ReleaseService = {
    endpoint: string;
    validRepo: (segments: string[]) => boolean;
    url: (request: { endpoint: string; repo: string; includePrereleases?: boolean }) => string;
    headers: (token?: string) => Record<string, string | undefined>;
    toRelease: (data: unknown, request: { repo: string }) => ParsedRelease;
};

export const services: Record<string, ReleaseService> = {
    github: {
        endpoint: "https://api.github.com",
        validRepo: (segments: string[]) => segments.length === 2,
        url: ({
            endpoint,
            repo,
            includePrereleases,
        }: {
            endpoint: string;
            repo: string;
            includePrereleases?: boolean;
        }) => `${endpoint}/repos/${repo}/releases${includePrereleases ? "?per_page=10" : "/latest"}`,
        headers: (token?: string) => ({
            Accept: "application/vnd.github+json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        toRelease: (data, { repo }) => {
            const release = Array.isArray(data)
                ? (data as GithubRelease[]).find((item) => !item.draft)
                : (data as GithubRelease);
            requireTag(release);
            return {
                name: repo,
                version: normalizeVersion(release.tag_name),
                url: release.html_url,
                date: parseDate(release.published_at),
                downvotes: release.reactions?.["-1"] ?? 0,
            };
        },
    },
    gitlab: {
        endpoint: "https://gitlab.com/api/v4",
        validRepo: (segments: string[]) => segments.length >= 2,
        url: ({ endpoint, repo }: { endpoint: string; repo: string }) =>
            `${endpoint}/projects/${encodeURIComponent(repo)}/releases/permalink/latest`,
        headers: (token?: string) => (token ? { "PRIVATE-TOKEN": token } : {}),
        toRelease: (data, { repo }) => {
            const release = data as GitlabRelease;
            requireTag(release);
            return {
                name: repo,
                version: normalizeVersion(release.tag_name),
                url: release._links?.self,
                date: parseDate(release.released_at),
            };
        },
    },
    forgejo: {
        endpoint: "https://codeberg.org/api/v1",
        validRepo: (segments: string[]) => segments.length === 2,
        url: ({ endpoint, repo }: { endpoint: string; repo: string }) => `${endpoint}/repos/${repo}/releases/latest`,
        headers: (token?: string) => (token ? { Authorization: `token ${token}` } : {}),
        toRelease: (data, { repo }) => {
            const release = data as ForgejoRelease;
            requireTag(release);
            return {
                name: repo,
                version: normalizeVersion(release.tag_name),
                url: release.html_url,
                date: parseDate(release.published_at),
            };
        },
    },
};

const serviceNames = Object.keys(services).join(", ");

function parseEndpoint(name: string, endpoint: unknown) {
    if (endpoint === undefined) return services[name].endpoint;
    let url;
    try {
        url = typeof endpoint === "string" ? new URL(endpoint) : null;
    } catch {
        url = null;
    }
    if (!url || !["http:", "https:"].includes(url.protocol)) {
        throw new Error(`servicesConfig.${name}.endpoint must be an http(s) URL`);
    }
    return url.href.replace(/\/+$/, "");
}

// returns { <service>: { endpoint, token } } for every service, filling in public defaults
export function parseServicesConfig(servicesConfig: unknown): Record<string, ReleaseServiceConfig> {
    if (servicesConfig !== undefined && servicesConfig !== null && !isPlainObject(servicesConfig)) {
        throw new Error("servicesConfig must be a map of service name to { endpoint, token }");
    }
    const config: PlainObject = servicesConfig ?? {};

    const unknownNames = Object.keys(config).filter((name) => !services[name]);
    if (unknownNames.length) {
        throw new Error(`Unknown service in servicesConfig: ${unknownNames.join(", ")}. Supported: ${serviceNames}`);
    }

    return Object.fromEntries(
        Object.keys(services).map((name) => {
            const entry = config[name] ?? {};
            if (!isPlainObject(entry) || !hasOnlyKeys(entry, SERVICE_CONFIG_KEYS)) {
                throw new Error(`servicesConfig.${name} only accepts endpoint and token`);
            }
            if (entry.token !== undefined && typeof entry.token !== "string") {
                throw new Error(`servicesConfig.${name}.token must be a string`);
            }
            return [name, { endpoint: parseEndpoint(name, entry.endpoint), token: entry.token || undefined }];
        })
    );
}

// { service: "github", repo: "owner/repo" }; gitlab also accepts "group/sub/project"
// includePrereleases is the widget-level flag and only applies to github
export function parseRepository(entry: unknown, includePrereleases: boolean | string = false): ReleaseRepository {
    const invalid = (reason: string) => new Error(`Invalid repository ${JSON.stringify(entry)}: ${reason}`);

    if (!isPlainObject(entry) || !hasOnlyKeys(entry, ENTRY_KEYS) || !ENTRY_KEYS.every((key) => key in entry)) {
        throw invalid("each entry must have exactly the keys service and repo");
    }
    const { service } = entry;
    if (typeof service !== "string" || !services[service]) throw invalid(`service must be one of ${serviceNames}`);
    if (typeof entry.repo !== "string") throw invalid("repo must be a string");

    const repo = entry.repo.trim();
    const segments = repo.split("/");
    if (!services[service].validRepo(segments) || !segments.every(isSegment)) {
        throw invalid("repo must be an owner/repo name, not a URL");
    }

    return { service, repo, includePrereleases: service === "github" && isTrue(includePrereleases) };
}
