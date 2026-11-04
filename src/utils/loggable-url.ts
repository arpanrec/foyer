// The URL without its query, hash or credentials, which may hold API keys and tokens, for logging
export function loggableUrl(url: string | URL) {
    try {
        const { protocol, host, pathname } = new URL(url);
        return `${protocol}//${host}${pathname}`;
    } catch {
        return "an invalid URL";
    }
}
