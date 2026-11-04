// http(s) URLs, and protocol-relative ones (//host/path), which a browser loads from another host like any other
const ABSOLUTE_URL = /^(?:https?:)?\/\//i;

// The URL with a scheme, or undefined for a path or a data: URI. A protocol-relative URL is fetched over https.
export function absoluteImageUrl(url: string) {
    if (!ABSOLUTE_URL.test(url)) return undefined;
    return url.startsWith("//") ? `https:${url}` : url;
}

// A full URL goes through the Foyer server, so the browser only ever talks to Foyer. Relative paths and data: URIs are
// already served by this origin or need no request. The quote is escaped for use inside a CSS url('...').
// `maxAgeSeconds` limits how long the server and the browser reuse a copy, for images that change at a fixed URL.
export function proxiedImageUrl(url: string, maxAgeSeconds?: number) {
    const absolute = absoluteImageUrl(url);
    if (!absolute) return url;
    const age = maxAgeSeconds === undefined ? "" : `&maxAge=${Math.max(0, Math.floor(maxAgeSeconds))}`;
    return `/api/icon-proxy?url=${encodeURIComponent(absolute).replaceAll("'", "%27")}${age}`;
}

// The settings background has its own unauthenticated endpoint, because the sign-in page shows it too
export function backgroundImageUrl(url: string) {
    return absoluteImageUrl(url) ? "/api/background" : url;
}
