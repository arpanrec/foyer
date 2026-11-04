import { describe, expect, it } from "vitest";

import { xmlToCompact } from "@/utils/xml";

describe("utils/xml", () => {
    describe("xmlToCompact", () => {
        it("reads attributes into _attributes and drops whitespace between elements", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="2" allowSync="0">
  <Directory key="1" type="movie" title="Movies"/>
  <Directory key="2" type="show" title="TV"/>
</MediaContainer>`;

            expect(xmlToCompact(xml)).toEqual({
                MediaContainer: {
                    _attributes: { size: "2", allowSync: "0" },
                    Directory: [
                        { _attributes: { key: "1", type: "movie", title: "Movies" } },
                        { _attributes: { key: "2", type: "show", title: "TV" } },
                    ],
                },
            });
        });

        it("keeps a single repeated-capable element as an object and repeats as an array", () => {
            expect(xmlToCompact(`<a><b>1</b></a>`)).toEqual({ a: { b: { _text: "1" } } });
            expect(xmlToCompact(`<a><b>1</b><c/><b>2</b><b>3</b></a>`)).toEqual({
                a: { b: [{ _text: "1" }, { _text: "2" }, { _text: "3" }], c: {} },
            });
        });

        it("reads CDATA into _cdata and keeps its content as written", () => {
            const xml = `<QDocRoot version="1.0"><authPassed><![CDATA[1]]></authPassed><cpu><![CDATA[ 4.5 % ]]></cpu></QDocRoot>`;

            expect(xmlToCompact(xml)).toEqual({
                QDocRoot: {
                    _attributes: { version: "1.0" },
                    authPassed: { _cdata: "1" },
                    cpu: { _cdata: " 4.5 % " },
                },
            });
        });

        it("drops empty CDATA and empty elements to {}", () => {
            expect(xmlToCompact(`<a><b><![CDATA[]]></b><c></c><d/></a>`)).toEqual({ a: { b: {}, c: {}, d: {} } });
        });

        it("keeps attributes and text of the same element together", () => {
            expect(xmlToCompact(`<title type="html">E1</title>`)).toEqual({
                title: { _attributes: { type: "html" }, _text: "E1" },
            });
        });

        it("keeps surrounding whitespace inside text", () => {
            expect(xmlToCompact(`<a><b> padded </b></a>`)).toEqual({ a: { b: { _text: " padded " } } });
        });

        it("keeps separate text and CDATA runs of one element as arrays", () => {
            expect(xmlToCompact(`<a>one<b>two</b>three</a>`)).toEqual({
                a: { _text: ["one", "three"], b: { _text: "two" } },
            });
            expect(xmlToCompact(`<a>pre<![CDATA[mid]]>post</a>`)).toEqual({
                a: { _text: ["pre", "post"], _cdata: "mid" },
            });
            expect(xmlToCompact(`<a><![CDATA[x]]><![CDATA[y]]></a>`)).toEqual({ a: { _cdata: ["x", "y"] } });
        });

        it("decodes named and numeric entities in text and attributes once", () => {
            expect(xmlToCompact(`<a>&lt;p&gt; &amp;amp; &#39;q&#39; &quot;x&quot; &#169; &#x41;</a>`)).toEqual({
                a: { _text: `<p> &amp; 'q' "x" © A` },
            });
            expect(xmlToCompact(`<a k="a &amp; b &#39;q&#39;"/>`)).toEqual({ a: { _attributes: { k: "a & b 'q'" } } });
        });

        it("does not expand entities defined in a DOCTYPE", () => {
            const xml = `<?xml version="1.0"?><!DOCTYPE a [<!ENTITY big "AAAAAAAAAA"><!ENTITY twice "&big;&big;">]><a>&twice;</a>`;

            expect(xmlToCompact(xml)).toEqual({ a: { _text: "&twice;" } });
        });

        it("leaves numbers and booleans as strings", () => {
            expect(xmlToCompact(`<a k="1"><n>0123</n><t>true</t></a>`)).toEqual({
                a: { _attributes: { k: "1" }, n: { _text: "0123" }, t: { _text: "true" } },
            });
        });

        it("keeps namespace prefixes in element and attribute names", () => {
            const xml = `<?xml version='1.0' encoding='utf-8'?><s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'><s:Body><u:GetStatusInfoResponse xmlns:u='urn:schemas-upnp-org:service:WANIPConnection:1'><NewConnectionStatus>Connected</NewConnectionStatus><NewUptime>42</NewUptime><NewEmpty/></u:GetStatusInfoResponse></s:Body></s:Envelope>`;

            expect(xmlToCompact(xml)).toEqual({
                "s:Envelope": {
                    _attributes: { "xmlns:s": "http://schemas.xmlsoap.org/soap/envelope/" },
                    "s:Body": {
                        "u:GetStatusInfoResponse": {
                            _attributes: { "xmlns:u": "urn:schemas-upnp-org:service:WANIPConnection:1" },
                            NewConnectionStatus: { _text: "Connected" },
                            NewUptime: { _text: "42" },
                            NewEmpty: {},
                        },
                    },
                },
            });
        });

        it("ignores the declaration and comments", () => {
            expect(xmlToCompact(`<?xml version="1.0"?><a><!-- note --><b>1</b></a>`)).toEqual({
                a: { b: { _text: "1" } },
            });
        });

        it("parses an RSS document", () => {
            const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title><link>https://x.test/</link><item><title><![CDATA[A &amp; B]]></title><link>https://x.test/1</link><media:thumbnail url="https://x.test/i.png" width="10"/></item><item><title>Two</title></item></channel></rss>`;

            expect(xmlToCompact(xml)).toEqual({
                rss: {
                    _attributes: { version: "2.0", "xmlns:media": "http://search.yahoo.com/mrss/" },
                    channel: {
                        title: { _text: "T" },
                        link: { _text: "https://x.test/" },
                        item: [
                            {
                                title: { _cdata: "A &amp; B" },
                                link: { _text: "https://x.test/1" },
                                "media:thumbnail": { _attributes: { url: "https://x.test/i.png", width: "10" } },
                            },
                            { title: { _text: "Two" } },
                        ],
                    },
                },
            });
        });

        it("parses an Atom document with two links", () => {
            const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><link rel="alternate" href="https://x.test/"/><link rel="self" href="https://x.test/feed"/><entry><content type="html"><![CDATA[<img src="a.png">]]></content></entry></feed>`;

            expect(xmlToCompact(xml)).toEqual({
                feed: {
                    _attributes: { xmlns: "http://www.w3.org/2005/Atom" },
                    link: [
                        { _attributes: { rel: "alternate", href: "https://x.test/" } },
                        { _attributes: { rel: "self", href: "https://x.test/feed" } },
                    ],
                    entry: { content: { _attributes: { type: "html" }, _cdata: '<img src="a.png">' } },
                },
            });
        });

        it("returns an empty document for an empty or blank string", () => {
            expect(xmlToCompact("")).toEqual({});
            expect(xmlToCompact("  \n")).toEqual({});
        });

        it("throws when the document is not well-formed", () => {
            expect(() => xmlToCompact("not xml")).toThrow("Invalid XML");
            expect(() => xmlToCompact("<a><b></a>")).toThrow("Invalid XML");
            expect(() => xmlToCompact("<a>")).toThrow("Invalid XML");
            expect(() => xmlToCompact("<html><body><br></body></html>")).toThrow("Invalid XML");
        });
    });
});
