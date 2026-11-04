import sax from "sax";

import { toIsoDate } from "@/utils/dates";
import { xmlToCompact } from "@/utils/xml";
import type { FeedItem, RawFeedItem, XmlAttributes, XmlNode } from "@/widgets/feed/types";

// An element can appear once (an object) or many times (an array)
const asArray = <T = XmlNode>(value: unknown): T[] =>
    value === undefined || value === null ? [] : (([] as unknown[]).concat(value) as T[]);

/**
 * Reads the text of an XML node, joining CDATA or text parts.
 *
 * @param node A compact XML node, string or undefined.
 * @returns The text, or an empty string.
 */
function getText(node: unknown): string {
    const first = asArray<XmlNode | string | undefined>(node)[0];
    if (first === undefined) return "";
    if (typeof first !== "object") return String(first);
    return asArray<string>(first._cdata ?? first._text).join("");
}

/**
 * Resolves a URL and keeps it only when it is http or https.
 *
 * @param value The URL or relative reference.
 * @param baseUrl The base for a relative reference.
 * @returns The absolute URL, or null when it is empty, invalid or another scheme.
 */
export function httpUrl(value: string | null | undefined, baseUrl?: string) {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed, baseUrl);
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

/**
 * Reads the attributes of an XML node.
 *
 * @param node A compact XML node.
 * @returns The attribute map, empty when there is none.
 */
const attrs = (node: unknown): XmlAttributes => (node as XmlNode | undefined)?._attributes ?? {};
/**
 * Tells whether a media node declares an image.
 *
 * @param node A compact XML node.
 * @returns True for `medium="image"` or an `image/*` type.
 */
const isImage = (node: unknown) => attrs(node)["medium"] === "image" || attrs(node)["type"]?.startsWith("image/");

/**
 * Finds the first image URL among an item's media thumbnails, media content, enclosures and enclosure links.
 *
 * @param item An RSS item node.
 * @returns The image URL, or null.
 */
function findImage(item: XmlNode) {
    const groups = [item, ...asArray(item["media:group"])];
    const candidates = [
        ...groups.flatMap((group) => asArray(group["media:thumbnail"])),
        ...groups.flatMap((group) => asArray(group["media:content"])).filter(isImage),
        ...asArray(item["enclosure"]).filter(isImage),
        ...asArray(item["link"]).filter((link) => attrs(link)["rel"] === "enclosure" && isImage(link)),
    ];
    const image = candidates.find((node) => attrs(node)["url"] || attrs(node)["href"]);
    return image ? attrs(image)["url"] || attrs(image)["href"] : null;
}

/**
 * Tells whether an image's width or height marks it as a tracking pixel.
 *
 * @param size The `width` and `height` attributes.
 * @returns True when either is 0 or 1.
 */
const isPixel = ({ width, height }: { width?: string | undefined; height?: string | undefined }) =>
    ["0", "1"].includes(width ?? "") || ["0", "1"].includes(height ?? "");

/**
 * Finds the first usable `<img>` in HTML snippets with the sax tokenizer, skipping tracking pixels.
 *
 * @param htmls HTML snippets, such as a description and the content.
 * @param baseUrl The base for relative image URLs.
 * @returns The image URL, or null.
 */
function findHtmlImage(htmls: string[], baseUrl?: string) {
    for (const html of htmls) {
        if (!html) continue;
        let image: string | null = null;
        const parser = sax.parser(false, { lowercase: true });
        parser.onopentag = ({ name, attributes }) => {
            if (!image && name === "img" && !isPixel(attributes)) {
                const { src } = attributes;
                image = httpUrl(typeof src === "string" ? src : undefined, baseUrl);
            }
        };
        parser.onerror = () => {
            parser.resume();
        };
        parser.write(html).close();
        if (image) return image;
    }
    return null;
}

/**
 * Converts an RSS `<item>` into a raw feed item.
 *
 * @param item The compact XML node.
 * @returns The raw item.
 */
function parseRssItem(item: XmlNode): RawFeedItem {
    const guid = asArray(item["guid"])[0];
    const guidLink = attrs(guid)["isPermaLink"] !== "false" ? getText(guid) : null;
    return {
        title: getText(item["title"]),
        link: getText(item["link"]) || guidLink,
        comments: getText(item["comments"]),
        date: getText(item["pubDate"]) || getText(item["dc:date"]),
        image: findImage(item),
        html: [getText(item["content:encoded"]), getText(item["description"])],
    };
}

/**
 * Finds the alternate link of an Atom entry, which is the one with `rel="alternate"` or no `rel`.
 *
 * @param node An Atom entry node.
 * @returns The link node, if any.
 */
const alternateLink = (node: XmlNode) =>
    asArray(node["link"]).find((l) => (attrs(l)["rel"] ?? "alternate") === "alternate");

/**
 * Converts an Atom `<entry>` into a raw feed item.
 *
 * @param entry The compact XML node.
 * @returns The raw item.
 */
function parseAtomEntry(entry: XmlNode): RawFeedItem {
    const link = alternateLink(entry) ?? asArray(entry["link"])[0];
    return {
        title: getText(entry["title"]),
        link: attrs(link)["href"],
        comments: undefined,
        date: getText(entry["published"]) || getText(entry["updated"]),
        image: findImage(entry),
        html: [getText(entry["content"]), getText(entry["summary"])],
    };
}

/**
 * Parses RSS or Atom XML into feed items.
 *
 * @param xml The feed document.
 * @returns The items, empty when the document is neither format.
 */
export function parseFeed(xml: string): FeedItem[] {
    // The compact document is plain objects keyed by element name
    const doc: Record<string, XmlNode | undefined> = xmlToCompact(xml);

    let items: RawFeedItem[];
    let site: string | undefined;
    if (doc["rss"]) {
        const channel = doc["rss"]["channel"] as XmlNode | undefined;
        items = asArray(channel?.["item"]).map(parseRssItem);
        site = getText(channel?.["link"]);
    } else if (doc["feed"]) {
        items = asArray(doc["feed"]["entry"]).map(parseAtomEntry);
        site = attrs(alternateLink(doc["feed"]))["href"];
    } else throw new Error("Unsupported feed format");

    // resolve against the feed's own site link, never the configured url
    const baseUrl = httpUrl(site) ?? undefined;

    return items
        .map((item) => ({
            title: item.title.trim(),
            link: httpUrl(item.link, baseUrl),
            comments: httpUrl(item.comments, baseUrl),
            date: toIsoDate(item.date),
            image: httpUrl(item.image, baseUrl) ?? findHtmlImage(item.html, baseUrl),
        }))
        .filter((item) => item.title);
}

/**
 * Tells whether a feed item links to a YouTube Short, a `/shorts/` path on youtube.com.
 *
 * @param item The item or anything with a `link`.
 * @returns True for a `/shorts/` link.
 */
export function isYouTubeShort(item: FeedItem | { link?: string | null | undefined }): boolean {
    if (!item.link) return false;
    try {
        const url = new URL(item.link);
        return (
            (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
            url.pathname.startsWith("/shorts/")
        );
    } catch {
        return item.link.includes("youtube.com/shorts/");
    }
}
