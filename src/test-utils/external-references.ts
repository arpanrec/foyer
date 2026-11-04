// Finds what a rendered page would make the browser load from another host. A page that holds none works for a user
// whose browser has no internet. A link someone clicks (<a href>) is navigation, not a load, and is left out.

export interface ExternalReference {
    tag: string;
    attribute: string;
    value: string;
}

const LOADING_ATTRIBUTES = ["src", "srcset", "poster", "data", "action", "formaction", "ping"];
// A <link> loads whatever its href names, whatever its rel: a stylesheet, an icon, a preload, a preconnect
const NAVIGATION_TAGS = new Set(["a", "area"]);

function hostOf(url: string, origin: string): string | undefined {
    const candidate = url.trim();
    // a scheme-relative URL (//host/path) goes to another host just like an absolute one
    if (!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(candidate)) return undefined;
    try {
        const parsed = new URL(candidate, origin);
        return parsed.origin === origin ? undefined : parsed.origin;
    } catch {
        return candidate;
    }
}

function urlsIn(text: string): string[] {
    // url(...) with or without quotes, and @import "..."
    const urls: string[] = [];
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
        urls.push((match[1] ?? match[2] ?? match[3] ?? "").trim());
    }
    for (const match of text.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) urls.push(match[1] ?? match[2] ?? "");
    return urls;
}

function srcsetUrls(srcset: string) {
    return srcset
        .split(",")
        .map((candidate) => candidate.trim().split(/\s+/)[0] ?? "")
        .filter(Boolean);
}

export function findExternalReferences(roots: ParentNode[], origin: string): ExternalReference[] {
    const found: ExternalReference[] = [];
    // one reference per element and URL, even when the same URL shows up in the attribute and in the CSSOM
    const reported = new WeakMap<Element, Set<string>>();
    let current: Element | undefined;
    const add = (tag: string, attribute: string, value: string) => {
        if (!hostOf(value, origin)) return;
        const seen = reported.get(current!) ?? new Set<string>();
        reported.set(current!, seen);
        if (seen.has(value)) return;
        seen.add(value);
        found.push({ tag, attribute, value });
    };

    for (const root of roots) {
        for (const element of root.querySelectorAll("*")) {
            current = element;
            const tag = element.tagName.toLowerCase();

            if (!NAVIGATION_TAGS.has(tag)) {
                for (const attribute of LOADING_ATTRIBUTES) {
                    const value = element.getAttribute(attribute);
                    if (value === null) continue;
                    if (attribute === "srcset") srcsetUrls(value).forEach((url) => add(tag, attribute, url));
                    else add(tag, attribute, value);
                }
                if (tag === "link") add(tag, "href", element.getAttribute("href") ?? "");
            }

            const style = element.getAttribute("style");
            if (style) urlsIn(style).forEach((url) => add(tag, "style", url));
            if (tag === "style") urlsIn(element.textContent ?? "").forEach((url) => add(tag, "textContent", url));
            // a mask or background set through the CSSOM rather than the attribute
            const inline = (element as HTMLElement).style;
            if (inline) {
                for (const property of ["background", "backgroundImage", "mask", "webkitMask", "maskImage"] as const) {
                    urlsIn(String((inline as unknown as Record<string, string>)[property] ?? "")).forEach((url) =>
                        add(tag, `style.${property}`, url)
                    );
                }
            }
        }
    }
    return found;
}
