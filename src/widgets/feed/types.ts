export type FeedOptions = {
    layout?: string;
    urls?: unknown;
    linkTo?: string;
    maxItems?: number | string;
    cache?: number | string;
    images?: boolean | string;
    disableYouTubeShorts?: boolean | string;
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
    link?: string | null;
    date?: string | null;
    image?: string | null;
};

export type FeedResponse = {
    items?: FeedResponseItem[];
};

// Attributes of an element in an xml-js compact document
export type XmlAttributes = Record<string, string | undefined>;

// An element in an xml-js compact document: its attributes, text and child elements
export type XmlNode = {
    _attributes?: XmlAttributes;
    _cdata?: string | string[];
    _text?: string | string[];
    [child: string]: unknown;
};

// An RSS item or Atom entry before its urls are resolved
export type RawFeedItem = {
    title: string;
    link?: string | null;
    comments?: string;
    date: string;
    image?: string | null;
    html: string[];
};
