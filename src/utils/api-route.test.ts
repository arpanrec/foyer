import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({ logger: { error: vi.fn() } }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

import type { ApiRequest, ApiResponse } from "@/types/api";
import { toRouteHandler, toRouteHandlers } from "@/utils/api-route";

type CallOptions = NonNullable<ConstructorParameters<typeof NextRequest>[1]> & {
    url?: string;
    params?: Record<string, string | string[]>;
};

function call(
    handler: (req: ApiRequest, res: ApiResponse) => unknown,
    { url = "http://localhost:3000/api/test", params = {}, ...init }: CallOptions = {}
) {
    return toRouteHandler(handler)(new NextRequest(url, init), { params: Promise.resolve(params) });
}

describe("utils/api-route request", () => {
    it("builds the query from search params and route params, with route params winning", async () => {
        let req: ApiRequest | undefined;
        await call(
            (r: ApiRequest, res: ApiResponse) => {
                req = r;
                res.end();
            },
            { url: "http://localhost:3000/api/test?a=1&b=2&b=3&service=query", params: { service: ["svc", "name"] } }
        );
        expect(req?.query).toEqual({ a: "1", b: ["2", "3"], service: ["svc", "name"] });
        expect(req?.method).toBe("GET");
        expect(req?.url).toBe("/api/test?a=1&b=2&b=3&service=query");
    });

    it("passes lowercase headers and parsed cookies", async () => {
        let req: ApiRequest | undefined;
        await call(
            (r: ApiRequest, res: ApiResponse) => {
                req = r;
                res.end();
            },
            { headers: { "X-Custom": "yes", Cookie: "a=1; b=two" } }
        );
        expect(req?.headers?.["x-custom"]).toBe("yes");
        expect(req?.cookies).toEqual({ a: "1", b: "two" });
    });

    it.each([
        ["application/json", '{"x":1}', { x: 1 }],
        ["application/json", "", {}],
        ["application/x-www-form-urlencoded", "a=1&b=2&b=3", { a: "1", b: ["2", "3"] }],
        ["text/plain", "hello", "hello"],
        [undefined, "raw", "raw"],
    ])("parses a %s body like the Pages Router", async (contentType, body, expected) => {
        let req: ApiRequest | undefined;
        await call(
            (r: ApiRequest, res: ApiResponse) => {
                req = r;
                res.end();
            },
            { method: "POST", body, headers: contentType ? { "content-type": contentType } : {} }
        );
        expect(req?.body).toEqual(expected);
    });

    it("gives GET requests an empty string body, as the Pages Router does", async () => {
        let req: ApiRequest | undefined;
        await call((r: ApiRequest, res: ApiResponse) => {
            req = r;
            res.end();
        });
        expect(req?.body).toBe("");
    });

    it("rejects invalid JSON and oversized bodies before the handler runs", async () => {
        const handler = vi.fn();
        const invalid = await call(handler, {
            method: "POST",
            body: "{",
            headers: { "content-type": "application/json" },
        });
        expect(invalid.status).toBe(400);
        expect(await invalid.text()).toBe("Invalid JSON");

        const oversized = await call(handler, { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
        expect(oversized.status).toBe(413);
        expect(handler).not.toHaveBeenCalled();
    });
});

describe("utils/api-route response", () => {
    it("sends JSON with status and headers", async () => {
        const res = await call((req: ApiRequest, r: ApiResponse) => {
            r.status(201);
            r.setHeader("X-Test", "1");
            r.json({ ok: true });
        });
        expect(res.status).toBe(201);
        expect(res.headers.get("x-test")).toBe("1");
        expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(await res.json()).toEqual({ ok: true });
    });

    it("sends strings as-is and Buffers as octet-stream unless a type is set", async () => {
        const text = await call((req: ApiRequest, r: ApiResponse) => r.send("plain"));
        expect(text.headers.get("content-type")).toBeNull();
        expect(await text.text()).toBe("plain");

        const binary = await call((req: ApiRequest, r: ApiResponse) => r.send(Buffer.from([1, 2, 3])));
        expect(binary.headers.get("content-type")).toBe("application/octet-stream");
        expect(new Uint8Array(await binary.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

        const image = await call((req: ApiRequest, r: ApiResponse) => {
            r.setHeader("Content-Type", "image/png");
            r.send(Buffer.from([4]));
        });
        expect(image.headers.get("content-type")).toBe("image/png");
    });

    it("keeps every Set-Cookie value and reads headers back", async () => {
        let seen;
        const res = await call((req: ApiRequest, r: ApiResponse) => {
            r.setHeader("Set-Cookie", ["a=1", "b=2"]);
            seen = r.getHeader("set-cookie");
            r.end();
        });
        expect(seen).toEqual(["a=1", "b=2"]);
        expect(res.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
    });

    it("answers a matching If-None-Match with 304", async () => {
        const first = await call((req: ApiRequest, r: ApiResponse) => r.json({ v: 1 }));
        const etag = first.headers.get("etag");
        expect(etag).toBeTruthy();

        const second = await call((req: ApiRequest, r: ApiResponse) => r.json({ v: 1 }), {
            headers: { "if-none-match": etag ?? "" },
        });
        expect(second.status).toBe(304);
        expect(await second.text()).toBe("");
    });

    it("drops the body for 204 and HEAD", async () => {
        const noContent = await call((req: ApiRequest, r: ApiResponse) => r.status(204).send("ignored"));
        expect(noContent.status).toBe(204);
        expect(noContent.body).toBeNull();

        const head = await call((req: ApiRequest, r: ApiResponse) => r.send("body"), { method: "HEAD" });
        expect(head.status).toBe(200);
        expect(head.body).toBeNull();
    });

    it("supports writeHead, write, end and redirect", async () => {
        const written = await call((req: ApiRequest, r: ApiResponse) => {
            r.writeHead(202, { "X-Step": "head" });
            r.write?.("a");
            r.end("b");
        });
        expect(written.status).toBe(202);
        expect(written.headers.get("x-step")).toBe("head");
        expect(await written.text()).toBe("ab");

        const redirected = await call((req: ApiRequest, r: ApiResponse) => r.redirect("/elsewhere"));
        expect(redirected.status).toBe(307);
        expect(redirected.headers.get("location")).toBe("/elsewhere");
    });

    it("waits for a response that is ended after the handler returns", async () => {
        const res = await call((req: ApiRequest, r: ApiResponse) => {
            setTimeout(() => r.status(200).send("later"), 5);
        });
        expect(await res.text()).toBe("later");
    });

    it("turns an uncaught error into a logged 500", async () => {
        const res = await call(() => {
            throw new Error("boom");
        });
        expect(res.status).toBe(500);
        expect(await res.text()).toBe("Internal Server Error");
        expect(logger.error).toHaveBeenCalled();
    });
});

describe("utils/api-route toRouteHandlers", () => {
    it("exports the same handler for every method", async () => {
        const handler = vi.fn((req: ApiRequest, res: ApiResponse) => res.send(req.method));
        const routes = toRouteHandlers(handler);
        expect(Object.keys(routes)).toEqual(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
        const res = await routes.DELETE(new NextRequest("http://localhost:3000/api/x", { method: "DELETE" }), {
            params: Promise.resolve({}),
        });
        expect(await res.text()).toBe("DELETE");
    });
});
