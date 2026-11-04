const REDDIT_HOST = /(^|\.)(reddit\.com|redd\.it|redditmedia\.com|redditstatic\.com)$/i;

// The User-Agent Foyer sends on outbound requests such as feeds, images, icons, streams, calendars and releases. Reddit rejects requests without one and
// asks for `<platform>:<app id>:<version> (by /u/<user>)`, so its hosts get that shape with the project URL.
export function foyerUserAgent(url: string | URL) {
    const version = process.env.NEXT_PUBLIC_VERSION || "dev";
    const host = new URL(url).hostname;
    return REDDIT_HOST.test(host)
        ? `foyer:self-hosted-dashboard:${version} (+https://github.com/arpanrec/foyer)`
        : `foyer/${version}`;
}
