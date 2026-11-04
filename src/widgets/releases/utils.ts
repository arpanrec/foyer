import { toIsoDate } from "@/utils/dates";
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

/**
 * Tells whether a value is a safe URL path segment.
 *
 * @param value The segment.
 * @returns True for word characters, dots and dashes, but not `.` or `..`.
 */
const isSegment = (value: string) => SEGMENT.test(value) && value !== "." && value !== "..";
/**
 * Tells whether a config flag is on, as a boolean or the string "true".
 *
 * @param value The flag.
 * @returns True when on.
 */
const isTrue = (value: unknown) => value === true || value === "true";
/**
 * Narrows a value to a plain object.
 *
 * @param value The value to test.
 * @returns True for a non-null, non-array object.
 */
const isPlainObject = (value: unknown): value is PlainObject =>
    value !== null && typeof value === "object" && !Array.isArray(value);
/**
 * Tells whether an object has no keys outside an allowed list.
 *
 * @param value The object.
 * @param keys The allowed keys.
 * @returns True when every key is allowed.
 */
const hasOnlyKeys = (value: PlainObject, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));

/**
 * Lowercases a version and adds a leading `v`.
 *
 * @param version The version as reported.
 * @returns The normalized version, or an empty string.
 */
export function normalizeVersion(version: unknown) {
    const normalized = String(version ?? "")
        .trim()
        .toLowerCase();
    return normalized && !normalized.startsWith("v") ? `v${normalized}` : normalized;
}

/**
 * Asserts that a release response has a tag name.
 *
 * @param data The response data.
 * @throws When there is no tag name.
 */
function requireTag<T extends { tag_name?: string }>(data: T | undefined): asserts data is T {
    if (!data?.tag_name) throw new Error("No releases found");
}

// endpoint is the API base URL; the default is the public instance
export type ReleaseService = {
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
                date: toIsoDate(release.published_at),
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
                date: toIsoDate(release.released_at),
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
                date: toIsoDate(release.published_at),
            };
        },
    },
};

const serviceNames = Object.keys(services).join(", ");

/**
 * Validates a service endpoint from the config.
 *
 * @param name The service name, for the error message.
 * @param endpoint The configured endpoint.
 * @param defaultEndpoint The endpoint used when none is configured.
 * @returns The endpoint without a trailing slash.
 * @throws When it is not an http(s) URL.
 */
function parseEndpoint(name: string, endpoint: unknown, defaultEndpoint: string) {
    if (endpoint === undefined) return defaultEndpoint;
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

/**
 * Validates the services config and fills in the public defaults.
 *
 * @param servicesConfig Map of service name to `{ endpoint, token }`.
 * @returns `{ endpoint, token }` for every service.
 * @throws When the config is malformed.
 */
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
        Object.entries(services).map(([name, service]) => {
            const entry = config[name] ?? {};
            if (!isPlainObject(entry) || !hasOnlyKeys(entry, SERVICE_CONFIG_KEYS)) {
                throw new Error(`servicesConfig.${name} only accepts endpoint and token`);
            }
            if (entry["token"] !== undefined && typeof entry["token"] !== "string") {
                throw new Error(`servicesConfig.${name}.token must be a string`);
            }
            return [
                name,
                {
                    endpoint: parseEndpoint(name, entry["endpoint"], service.endpoint),
                    token: entry["token"] || undefined,
                },
            ];
        })
    );
}

/**
 * Validates one repository entry from the widget config.
 *
 * @param entry `{ service, repo }`. GitLab also accepts `group/sub/project`.
 * @param includePrereleases The widget-level flag, which only applies to GitHub.
 * @returns The repository request.
 * @throws When the entry is malformed.
 */
export function parseRepository(entry: unknown, includePrereleases: boolean | string = false): ReleaseRepository {
    const invalid = (reason: string) => new Error(`Invalid repository ${JSON.stringify(entry)}: ${reason}`);

    if (!isPlainObject(entry) || !hasOnlyKeys(entry, ENTRY_KEYS) || !ENTRY_KEYS.every((key) => key in entry)) {
        throw invalid("each entry must have exactly the keys service and repo");
    }
    const { service } = entry;
    if (typeof service !== "string" || !services[service]) throw invalid(`service must be one of ${serviceNames}`);
    if (typeof entry["repo"] !== "string") throw invalid("repo must be a string");

    const repo = entry["repo"].trim();
    const segments = repo.split("/");
    if (!services[service].validRepo(segments) || !segments.every(isSegment)) {
        throw invalid("repo must be an owner/repo name, not a URL");
    }

    return { service, repo, includePrereleases: service === "github" && isTrue(includePrereleases) };
}
