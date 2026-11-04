export type FeedOptions = {
    layout?: string | undefined;
    urls?: unknown;
    linkTo?: string | undefined;
    maxItems?: number | string | undefined;
    cache?: number | string | undefined;
    images?: boolean | string | undefined;
    disableYouTubeShorts?: boolean | string | undefined;
};

// An item parsed from an RSS or Atom document
export type FeedItem = {
    title: string;
    link: string | null;
    comments: string | null;
    date: string | null;
    image: string | null;
};

// An item as the proxy sends it to the component
export type FeedResponseItem = {
    title: string;
    link?: string | null | undefined;
    date?: string | null | undefined;
    image?: string | null | undefined;
};

export type FeedResponse = {
    items?: FeedResponseItem[] | undefined;
};

// Attributes of an element in a compact XML document
export type XmlAttributes = Record<string, string | undefined>;

// An element in a compact XML document: its attributes, text and child elements
export type XmlNode = {
    _attributes?: XmlAttributes | undefined;
    _cdata?: string | string[] | undefined;
    _text?: string | string[] | undefined;
    [child: string]: unknown;
};

// An RSS item or Atom entry before its urls are resolved
export type RawFeedItem = {
    title: string;
    link?: string | null | undefined;
    comments?: string | undefined;
    date: string;
    image?: string | null | undefined;
    html: string[];
};
