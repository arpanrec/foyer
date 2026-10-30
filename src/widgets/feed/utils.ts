import sax from "sax";
import { xml2js } from "xml-js";

import type { FeedItem, RawFeedItem, XmlAttributes, XmlNode } from "@/widgets/feed/types";

// An element can appear once (an object) or many times (an array)
const asArray = <T = XmlNode>(value: unknown): T[] =>
    value === undefined || value === null ? [] : (([] as unknown[]).concat(value) as T[]);

function getText(node: unknown): string {
    const first = asArray<XmlNode | string | undefined>(node)[0];
    if (first === undefined) return "";
    if (typeof first !== "object") return String(first);
    return asArray<string>(first._cdata ?? first._text).join("");
}

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

function parseDate(value: string) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
}

const attrs = (node: unknown): XmlAttributes => (node as XmlNode | undefined)?._attributes ?? {};
const isImage = (node: unknown) => attrs(node).medium === "image" || attrs(node).type?.startsWith("image/");

function findImage(item: XmlNode) {
    const groups = [item, ...asArray(item["media:group"])];
    const candidates = [
        ...groups.flatMap((group) => asArray(group["media:thumbnail"])),
        ...groups.flatMap((group) => asArray(group["media:content"])).filter(isImage),
        ...asArray(item.enclosure).filter(isImage),
        ...asArray(item.link).filter((link) => attrs(link).rel === "enclosure" && isImage(link)),
    ];
    const image = candidates.find((node) => attrs(node).url || attrs(node).href);
    return image ? attrs(image).url || attrs(image).href : null;
}

const isPixel = ({ width, height }: { width?: string; height?: string }) =>
    ["0", "1"].includes(width ?? "") || ["0", "1"].includes(height ?? "");

// first usable <img> in item html using sax tokenizer
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

function parseRssItem(item: XmlNode): RawFeedItem {
    const guid = asArray(item.guid)[0];
    const guidLink = attrs(guid).isPermaLink !== "false" ? getText(guid) : null;
    return {
        title: getText(item.title),
        link: getText(item.link) || guidLink,
        comments: getText(item.comments),
        date: getText(item.pubDate) || getText(item["dc:date"]),
        image: findImage(item),
        html: [getText(item["content:encoded"]), getText(item.description)],
    };
}

const alternateLink = (node: XmlNode) => asArray(node.link).find((l) => (attrs(l).rel ?? "alternate") === "alternate");

function parseAtomEntry(entry: XmlNode): RawFeedItem {
    const link = alternateLink(entry) ?? asArray(entry.link)[0];
    return {
        title: getText(entry.title),
        link: attrs(link).href,
        comments: undefined,
        date: getText(entry.published) || getText(entry.updated),
        image: findImage(entry),
        html: [getText(entry.content), getText(entry.summary)],
    };
}

export function parseFeed(xml: string): FeedItem[] {
    // Compact mode turns the document into plain objects keyed by element name
    const doc = xml2js(xml, { compact: true }) as Record<string, XmlNode | undefined>;

    let items: RawFeedItem[];
    let site: string | undefined;
    if (doc.rss) {
        const channel = doc.rss.channel as XmlNode | undefined;
        items = asArray(channel?.item).map(parseRssItem);
        site = getText(channel?.link);
    } else if (doc.feed) {
        items = asArray(doc.feed.entry).map(parseAtomEntry);
        site = attrs(alternateLink(doc.feed)).href;
    } else throw new Error("Unsupported feed format");

    // resolve against the feed's own site link, never the configured url
    const baseUrl = httpUrl(site) ?? undefined;

    return items
        .map((item) => ({
            title: item.title.trim(),
            link: httpUrl(item.link, baseUrl),
            comments: httpUrl(item.comments, baseUrl),
            date: parseDate(item.date),
            image: httpUrl(item.image, baseUrl) ?? findHtmlImage(item.html, baseUrl),
        }))
        .filter((item) => item.title);
}

export function isYouTubeShort(item: FeedItem | { link?: string | null }): boolean {
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
