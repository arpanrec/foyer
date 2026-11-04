// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { findExternalReferences } from "@/test-utils/external-references";

const origin = "http://localhost:3000";

function find(html: string) {
    document.body.innerHTML = html;
    return findExternalReferences([document.body], origin);
}

describe("test-utils/external-references", () => {
    beforeEach(() => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("finds what would load from another host", () => {
        const found = find(`
            <img src="https://cdn.example.com/a.png">
            <img srcset="/local.png 1x, https://cdn.example.com/b.png 2x">
            <iframe src="http://other.lan/"></iframe>
            <video poster="//cdn.example.com/p.jpg"></video>
            <div style="background-image: url('https://cdn.example.com/bg.png')"></div>
            <div style="mask: url(//cdn.example.com/m.svg) no-repeat"></div>
            <style>@import "https://fonts.example.com/f.css"; .x { background: url(http://cdn.example.com/x.png) }</style>
            <link rel="preconnect" href="https://api.example.com">
            <script src="https://cdn.example.com/x.js"></script>
        `);

        expect(found.map((f) => f.value)).toEqual(
            expect.arrayContaining([
                "https://cdn.example.com/a.png",
                "https://cdn.example.com/b.png",
                "http://other.lan/",
                "//cdn.example.com/p.jpg",
                "https://cdn.example.com/bg.png",
                "//cdn.example.com/m.svg",
                "https://fonts.example.com/f.css",
                "http://cdn.example.com/x.png",
                "https://api.example.com",
                "https://cdn.example.com/x.js",
            ])
        );
        expect(found).toHaveLength(10);
    });

    it("leaves out this origin, relative paths, data URIs and clickable links", () => {
        expect(
            find(`
                <img src="/api/icon-proxy?url=https%3A%2F%2Fcdn.example.com%2Fa.png">
                <img src="http://localhost:3000/a.png">
                <img src="data:image/svg+xml;base64,AAAA">
                <img src="relative/a.png">
                <div style="background-image: url('/api/background')"></div>
                <a href="https://github.com/arpanrec">link</a>
                <link rel="manifest" href="/site.webmanifest">
            `)
        ).toEqual([]);
    });

    it("sees a style set through the CSSOM", () => {
        document.body.innerHTML = "<div></div>";
        (document.body.firstElementChild as HTMLElement).style.backgroundImage = "url(https://cdn.example.com/a.png)";
        expect(findExternalReferences([document.body], origin)).toHaveLength(1);
    });

    it("looks in every root it is given", () => {
        document.head.innerHTML = '<link rel="icon" href="https://cdn.example.com/f.ico">';
        expect(findExternalReferences([document.head, document.body], origin)).toHaveLength(1);
    });
});
