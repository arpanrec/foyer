import cache from "@/utils/cache";
import { getConfig } from "@/utils/config/store";
import { absoluteImageUrl } from "@/utils/image-url";

// /api/icon-proxy only fetches an address Foyer itself handed to the browser: one written in the config, or one the
// server found in a service discovery result or a widget reply. Anything else is refused, so the route cannot be used
// to make the server request other hosts.

// How long a recorded address stays allowed. Recording again, on every response that carries it, starts it over. An
// address from service discovery stays for good (`keep`): the dashboard data that carries it is cached without an
// expiry, so nothing would record it again after a week.
const ALLOW_MS = 7 * 24 * 60 * 60 * 1000;

// Config members that can hold an image address, and the keys in them whose string value is one
const CONFIG_MEMBERS = ["services", "bookmarks", "widgets", "settings"] as const;
const IMAGE_KEYS = new Set(["icon", "favicon", "src"]);

// Each recorded address is one cache entry, which the cache drops once its TTL runs out. `publicOnly` marks an address
// that only third-party content, such as a feed item, has carried, and `keep` one that never expires.
type Recorded = { publicOnly: boolean; keep: boolean };

const KEY_PREFIX = "imageAllowlist:";

async function readRecorded(href: string): Promise<Recorded | undefined> {
    return cache.getOrFetch<Recorded>(KEY_PREFIX + href, async () => undefined, {
        type: "image-allowlist",
        label: "image allowlist entry",
    });
}

async function writeRecorded(href: string, entry: Recorded) {
    await cache.getOrFetch(KEY_PREFIX + href, async () => entry, {
        type: "image-allowlist",
        refresh: true,
        ttlMs: entry.keep ? undefined : ALLOW_MS,
        label: "image allowlist entry",
    });
}

// The address the way the fetch sees it, or undefined for a path, a data: URI or text that is not a URL
function normalize(url: unknown) {
    if (typeof url !== "string") return undefined;
    const absolute = absoluteImageUrl(url);
    if (!absolute) return undefined;
    try {
        return new URL(absolute).href;
    } catch {
        return undefined;
    }
}

// Records an address the server is about to send to the browser. Other values are ignored, so callers pass fields as
// they are. `external` is for an address a third party wrote, such as a feed item or a stream's avatar: it is fetched
// only from public hosts, so content from the internet cannot make the server call the local network.
export async function allowImageUrl(
    url: unknown,
    { external = false, keep = false }: { external?: boolean; keep?: boolean } = {}
) {
    const href = normalize(url);
    if (!href) return;

    // an address the config or a discovery also named stays unrestricted, and one kept for good stays kept
    // an entry that has run out is gone from the cache, so it cannot lend its flag to a third party's copy of the address
    const existing = await readRecorded(href);
    await writeRecorded(href, {
        publicOnly: external && (existing?.publicOnly ?? true),
        keep: keep || (existing?.keep ?? false),
    });
}

function configHasUrl(value: unknown, href: string, key?: string): boolean {
    if (typeof value === "string") return key !== undefined && IMAGE_KEYS.has(key) && normalize(value) === href;
    if (Array.isArray(value)) return value.some((item) => configHasUrl(item, href, key));
    if (value && typeof value === "object") {
        return Object.entries(value).some(([name, item]) => configHasUrl(item, href, name));
    }
    return false;
}

// Whether any config member names the address
async function configNamesUrl(href: string) {
    const members = await Promise.all(CONFIG_MEMBERS.map((member) => getConfig(member)));
    return members.some((value) => configHasUrl(value, href));
}

// Whether the address was recorded, or is an icon, favicon or src value in the services, bookmarks, widgets or settings
// config
export async function isImageUrlAllowed(url: string) {
    const href = normalize(url);
    if (!href) return false;

    if (await readRecorded(href)) return true;
    return configNamesUrl(href);
}

// Whether the address may only be fetched from a public host: a third party supplied it and the config does not name it
export async function isPublicOnlyImageUrl(url: string) {
    const href = normalize(url);
    if (!href) return false;

    const entry = await readRecorded(href);
    if (!entry?.publicOnly) return false;
    return !(await configNamesUrl(href));
}

function imageUrlsIn(value: unknown, key: string | undefined, found: string[]) {
    if (typeof value === "string") {
        if (key !== undefined && IMAGE_KEYS.has(key)) found.push(value);
    } else if (Array.isArray(value)) {
        for (const item of value) imageUrlsIn(item, key, found);
    } else if (value && typeof value === "object") {
        for (const [name, item] of Object.entries(value)) imageUrlsIn(item, name, found);
    }
    return found;
}

// Records every icon, favicon and src address found anywhere in a value, such as the services a discovery found. They
// stay allowed while the cache keeps them.
export async function allowImageUrlsIn(value: unknown) {
    await Promise.all(imageUrlsIn(value, undefined, []).map((url) => allowImageUrl(url, { keep: true })));
}
