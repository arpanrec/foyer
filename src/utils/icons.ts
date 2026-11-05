import cache from "@/utils/cache";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";
import { foyerUserAgent } from "@/utils/proxy/user-agent";

const logger = createLogger("icons");

// An image has no size limit, so a slow download is only cut off when no data arrives for this long
const IDLE_TIMEOUT_MS = 30_000;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const ICON_CONTENT_TYPES: Record<string, string> = {
    svg: "image/svg+xml",
    png: "image/png",
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    ico: "image/x-icon",
    avif: "image/avif",
};

// Icon sets are downloaded from a CDN the first time they are requested and then kept in the cache
const REMOTE_SETS = {
    mdi: (_ext: string, name: string) => `https://cdn.jsdelivr.net/npm/@mdi/svg@latest/svg/${name}.svg`,
    si: (_ext: string, name: string) => `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${name}.svg`,
    sh: (ext: string, name: string) => `https://cdn.jsdelivr.net/gh/selfhst/icons@main/${ext}/${name}.${ext}`,
    di: (ext: string, name: string) => `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/${ext}/${name}.${ext}`,
} as const;

const REMOTE_EXTENSIONS = new Set(["svg", "png", "webp"]);

export type IconResult = { body: Buffer; contentType: string };

// Hosts that do not know the type of a file, such as storage buckets and download links, send one of these or none
const GENERIC_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream", "application/binary"]);

// The raster image type a body starts as, like a browser works it out. SVG is not sniffed: it is text, and only a host
// that says image/svg+xml gets it served.
export function sniffImageType(data: Buffer): string | undefined {
    const starts = (bytes: number[], at = 0) => bytes.every((byte, i) => data[at + i] === byte);
    const text = (value: string, at: number) => data.subarray(at, at + value.length).toString("latin1") === value;

    if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
    if (text("GIF87a", 0) || text("GIF89a", 0)) return "image/gif";
    if (text("RIFF", 0) && text("WEBP", 8)) return "image/webp";
    if (text("ftypavif", 4) || text("ftypavis", 4)) return "image/avif";
    if (starts([0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
    return undefined;
}

export function isIconName(name: string) {
    return NAME_PATTERN.test(name) && !name.includes("..");
}

async function fetchImage(url: string, publicOnly: boolean): Promise<IconResult | undefined> {
    const [status, contentType, data] = await httpProxy(url, {
        method: "GET",
        headers: { "User-Agent": foyerUserAgent(url), Accept: "image/*" },
        timeout: IDLE_TIMEOUT_MS,
        // an image address is not a service the user logged in to, so none of the widgets' cookies go with it
        useCookieJar: false,
        publicOnly,
    });
    if (status !== 200 || !Buffer.isBuffer(data)) {
        logger.warn("Icon request to %s returned HTTP %d", new URL(url).host, status);
        return undefined;
    }
    const declared = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (data.length === 0) {
        logger.warn("Icon at %s is empty", url);
        return undefined;
    }
    if (declared.startsWith("image/")) return { body: data, contentType: declared };

    // a host that does not know what it serves is trusted only when the file itself is an image
    const sniffed = GENERIC_TYPES.has(declared) ? sniffImageType(data) : undefined;
    if (!sniffed) {
        logger.warn("Icon at %s is not an image (content type %s)", url, declared || "missing");
        return undefined;
    }
    return { body: data, contentType: sniffed };
}

// A copy is dropped after a week, so one that could not be refreshed is not served for ever
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

// A failed download is remembered this long, so a dead host costs one request per period, not one per page view
const FAILURE_MS = 5 * 60 * 1000;

export const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

// A downloaded image. `retryAfter` is set on a copy whose last refresh failed: until then it serves without another
// download, whatever the caller's maxAge.
type StoredImage = IconResult & { fetchedAt: number; retryAfter?: number };
// A download that failed and had no copy to fall back on
type StoredFailure = { failed: true; retryAfter: number };
type Stored = StoredImage | StoredFailure;

function isFailure(stored: Stored): stored is StoredFailure {
    return "failed" in stored;
}

// How long an entry stays in the cache: a copy keeps its week from its download, even after a failed refresh
function keepFor(stored: Stored) {
    if (isFailure(stored)) return FAILURE_MS;
    return Math.max(1, stored.fetchedAt + KEEP_MS - Date.now());
}

// The copy is shared by every caller of the URL, so its age is judged per caller: one that allows `maxAgeSeconds` reuses
// a younger copy, and an older one is downloaded again. When that fails, the old copy still serves, and the failure is
// remembered so the next callers do not wait on a host that is down. A failure with no copy is remembered the same way.
// `refresh`, for a client that sent Cache-Control: no-cache, downloads it again whatever the copy's age or a remembered
// failure, and stores what it gets; the old copy is only the fallback when that download fails.
async function cachedImage(
    url: string,
    maxAgeSeconds: number,
    publicOnly = false,
    refresh = false
): Promise<IconResult | undefined> {
    const load = (previous?: StoredImage) => async (): Promise<Stored> => {
        try {
            const fetched = await fetchImage(url, publicOnly);
            if (fetched) return { ...fetched, fetchedAt: Date.now() };
        } catch (error) {
            // httpProxy rejects with [status, error]
            logger.warn("Icon request to %s failed", new URL(url).host);
            logger.debug("Icon request to %s failed: %o", url, error);
        }
        const retryAfter = Date.now() + FAILURE_MS;
        return previous ? { ...previous, retryAfter } : { failed: true, retryAfter };
    };
    const options = { type: "image", ttlMs: keepFor } as const;

    if (refresh) {
        const previous = await cache.getOrFetch<Stored>(url, async () => undefined, options);
        const current = await cache.getOrFetch<Stored>(
            url,
            load(previous && !isFailure(previous) ? previous : undefined),
            { ...options, refresh: true }
        );
        return current && !isFailure(current) ? { body: current.body, contentType: current.contentType } : undefined;
    }

    const stored = await cache.getOrFetch<Stored>(url, load(), options);
    if (!stored || isFailure(stored)) return undefined;

    const fresh = Date.now() - stored.fetchedAt <= maxAgeSeconds * 1000;
    const waiting = stored.retryAfter !== undefined && stored.retryAfter > Date.now();
    const current =
        fresh || waiting ? stored : await cache.getOrFetch<Stored>(url, load(stored), { ...options, refresh: true });
    if (!current || isFailure(current)) return undefined;
    return { body: current.body, contentType: current.contentType };
}

// An icon from a set, downloaded from the CDN on first use, or again when `refresh` is set
export async function getIcon(segments: string[], refresh = false): Promise<IconResult | undefined> {
    const [set, ...rest] = segments;
    if (set !== "mdi" && set !== "si" && set !== "sh" && set !== "di") return undefined;

    // mdi and si are SVG only and sit directly under the set; sh and di add the format as a folder
    const single = set === "mdi" || set === "si";
    const [ext, file] = single ? ["svg", rest[0]] : rest;
    if (rest.length !== (single ? 1 : 2) || !ext || !file || !REMOTE_EXTENSIONS.has(ext)) return undefined;
    if (!file.endsWith(`.${ext}`) || !isIconName(file)) return undefined;

    const url = REMOTE_SETS[set](ext, file.slice(0, -(ext.length + 1)));
    const image = await cachedImage(url, DEFAULT_MAX_AGE_SECONDS, false, refresh);
    return image && { body: image.body, contentType: ICON_CONTENT_TYPES[ext]! };
}

// An image the user pointed a service, bookmark or widget at with a full URL. `publicOnly` is for an address a third
// party supplied, such as a feed item, and refuses any host on a private or local network. `refresh` downloads it again
// instead of serving the cached copy.
export async function getRemoteImage(
    rawUrl: string,
    maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
    publicOnly = false,
    refresh = false
): Promise<IconResult | undefined> {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return undefined;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

    return cachedImage(url.href, maxAgeSeconds, publicOnly, refresh);
}
