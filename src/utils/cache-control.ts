import type { IncomingHttpHeaders } from "node:http";

// The directive names in a Cache-Control or Pragma value, lowercased, without their arguments
function directives(value: string | string[] | undefined): string[] {
    const joined = Array.isArray(value) ? value.join(",") : (value ?? "");
    return joined
        .split(",")
        .map((part) => part.split("=")[0]!.trim().toLowerCase())
        .filter(Boolean);
}

// True when the client asked for a response that is not served from a cache without checking with the origin first:
// `Cache-Control: no-cache`, which browsers send on a hard reload, or, from a client that sends no Cache-Control at
// all, the older `Pragma: no-cache` (RFC 9111, section 5.4). Foyer has no way to revalidate a cached copy, so a caller
// downloads it again.
export function requestsNoCache(headers: IncomingHttpHeaders | undefined): boolean {
    const cacheControl = headers?.["cache-control"];
    if (cacheControl !== undefined) return directives(cacheControl).includes("no-cache");
    return directives(headers?.["pragma"]).includes("no-cache");
}
