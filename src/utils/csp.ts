import { getEnv } from "@/utils/env";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

const logger = createLogger("csp");

export type CspMode = "enforce" | "report-only" | "off";

const MODES: readonly CspMode[] = ["enforce", "report-only", "off"];

// A source in a CSP source list: a scheme, a host with an optional scheme, wildcard or port, and an optional path.
// Anything with a space, a quote, a comma or a semicolon could add a directive of its own, so it is refused.
const SOURCE =
    /^(?:[A-Za-z][A-Za-z0-9+.-]*:|(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)?(?:\*\.)?[A-Za-z0-9_.-]+(?::(?:\d+|\*))?(?:\/[^\s;,'"]*)?)$/;

export function cspMode(): CspMode {
    const value = (getEnv("CSP") ?? "").trim().toLowerCase();
    if (!value) return "enforce";
    if ((MODES as readonly string[]).includes(value)) return value as CspMode;
    warnOnce(logger, 'FOYER_CSP "%s" is not one of enforce, report-only or off; using enforce', value);
    return "enforce";
}

// The extra sources the iframe widget may load, from FOYER_CSP_FRAME_SRC (space or comma separated)
export function frameSources(): string[] {
    const sources: string[] = [];
    for (const source of (getEnv("CSP_FRAME_SRC") ?? "").split(/[\s,]+/).filter(Boolean)) {
        if (SOURCE.test(source)) sources.push(source);
        else warnOnce(logger, 'FOYER_CSP_FRAME_SRC entry "%s" is not a valid source and is ignored', source);
    }
    return sources;
}

// The browser may load from Foyer's own origin only: every icon, image, background, stream and widget answer reaches it
// through the server. The inline script and style allowances are for the page data and styles Next.js writes into the
// HTML. A page can frame only Foyer itself and what FOYER_CSP_FRAME_SRC lists.
export function buildCsp({ development = false, frameSrc = [] }: { development?: boolean; frameSrc?: string[] } = {}) {
    const directives: Record<string, string[]> = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'"],
        "connect-src": ["'self'"],
        "media-src": ["'self'"],
        "manifest-src": ["'self'"],
        "worker-src": ["'self'"],
        "frame-src": ["'self'", ...frameSrc],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
    };
    return Object.entries(directives)
        .map(([name, sources]) => `${name} ${sources.join(" ")}`)
        .join("; ");
}

// The header to put on a response, or undefined when the policy is off
export function cspHeader(): { name: string; value: string } | undefined {
    const mode = cspMode();
    if (mode === "off") return undefined;
    return {
        name: mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
        value: buildCsp({ development: process.env.NODE_ENV !== "production", frameSrc: frameSources() }),
    };
}
