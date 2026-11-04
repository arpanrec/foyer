import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isStreamContentType, openStream } from "@/utils/mjpeg";

let server: http.Server;
let seen: http.IncomingMessage | undefined;
let clientGone: Promise<void>;
let markClientGone: () => void;

function baseUrl() {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
    seen = undefined;
    clientGone = new Promise((resolve) => (markClientGone = resolve));
    server = http.createServer((req, res) => {
        seen = req;
        res.on("close", () => markClientGone());
        if (req.url === "/old") {
            res.writeHead(301, { Location: "/stream" });
            res.end();
            return;
        }
        if (req.url === "/old-absolute") {
            res.writeHead(302, { Location: `http://${req.headers.host}/stream` });
            res.end();
            return;
        }
        if (req.url === "/other-host") {
            const port = (server.address() as AddressInfo).port;
            res.writeHead(302, { Location: `http://localhost:${port}/stream` });
            res.end();
            return;
        }
        if (req.url === "/silent") {
            // headers never come
            return;
        }
        if (req.url === "/loop") {
            res.writeHead(302, { Location: "/loop" });
            res.end();
            return;
        }
        if (req.url === "/elsewhere") {
            res.writeHead(307, { Location: "ftp://cam.lan/stream" });
            res.end();
            return;
        }
        if (req.url === "/stream") {
            res.writeHead(200, { "Content-Type": "multipart/x-mixed-replace; boundary=frame" });
            res.write("--frame\r\nContent-Type: image/jpeg\r\n\r\nAAAA\r\n");
            // never ends, like a camera
            return;
        }
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("no");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});

describe("utils/mjpeg", () => {
    it("recognises stream and raster image content types, not SVG", () => {
        expect(isStreamContentType("multipart/x-mixed-replace; boundary=frame")).toBe(true);
        expect(isStreamContentType("image/jpeg")).toBe(true);
        expect(isStreamContentType("image/png; charset=binary")).toBe(true);
        expect(isStreamContentType("image/svg+xml")).toBe(false);
        expect(isStreamContentType("IMAGE/SVG+XML; charset=utf-8")).toBe(false);
        expect(isStreamContentType("text/html")).toBe(false);
        expect(isStreamContentType("")).toBe(false);
    });

    it("hands on the first frames before the stream ends, with a User-Agent and basic auth from the URL", async () => {
        const controller = new AbortController();
        const url = new URL(`${baseUrl()}/stream`);
        url.username = "cam";
        url.password = "secret";

        const upstream = await openStream(url, controller.signal);
        expect(upstream.status).toBe(200);
        expect(upstream.contentType).toContain("multipart/x-mixed-replace");

        const { value } = await upstream.body.getReader().read();
        expect(Buffer.from(value!).toString()).toContain("AAAA");

        expect(seen?.headers["user-agent"]).toMatch(/^foyer\//);
        expect(seen?.headers["authorization"]).toBe(`Basic ${Buffer.from("cam:secret").toString("base64")}`);
        controller.abort();
    });

    it("closes the connection to the camera when the viewer leaves", async () => {
        const controller = new AbortController();
        const upstream = await openStream(new URL(`${baseUrl()}/stream`), controller.signal);
        await upstream.body.getReader().read();

        controller.abort();
        await clientGone;
    });

    it("reports a non-200 answer without throwing", async () => {
        const upstream = await openStream(new URL(`${baseUrl()}/missing`), new AbortController().signal);
        expect(upstream.status).toBe(404);
        expect(isStreamContentType(upstream.contentType)).toBe(false);
        await upstream.body.cancel();
    });

    it("follows a redirect to the stream on the same host, keeping the password", async () => {
        const url = new URL(`${baseUrl()}/old`);
        url.username = "cam";
        url.password = "secret";

        const upstream = await openStream(url, new AbortController().signal);
        expect(upstream.status).toBe(200);
        expect(upstream.contentType).toContain("multipart/x-mixed-replace");
        expect(seen?.url).toBe("/stream");
        expect(seen?.headers["authorization"]).toBe(`Basic ${Buffer.from("cam:secret").toString("base64")}`);
        await upstream.body.cancel();
    });

    it("keeps the password through a redirect to an absolute address on the same host", async () => {
        const url = new URL(`${baseUrl()}/old-absolute`);
        url.username = "cam";
        url.password = "secret";

        const upstream = await openStream(url, new AbortController().signal);
        expect(upstream.status).toBe(200);
        expect(seen?.url).toBe("/stream");
        expect(seen?.headers["authorization"]).toBe(`Basic ${Buffer.from("cam:secret").toString("base64")}`);
        await upstream.body.cancel();
    });

    it("gives up on a redirect loop and on a redirect to another protocol", async () => {
        await expect(openStream(new URL(`${baseUrl()}/loop`), new AbortController().signal)).rejects.toThrow(
            /redirects/
        );
        await expect(openStream(new URL(`${baseUrl()}/elsewhere`), new AbortController().signal)).rejects.toThrow(
            /non-http/
        );
    });

    it("rejects when the camera cannot be reached", async () => {
        const url = new URL(`${baseUrl()}/stream`);
        await new Promise((resolve) => server.close(resolve));
        await expect(openStream(url, new AbortController().signal)).rejects.toThrow();
    });

    it("does not give the password to another host", async () => {
        const url = new URL(`${baseUrl()}/other-host`);
        url.username = "cam";
        url.password = "secret";

        const upstream = await openStream(url, new AbortController().signal);
        expect(upstream.status).toBe(200);
        expect(seen?.url).toBe("/stream");
        expect(seen?.headers["authorization"]).toBeUndefined();
        await upstream.body.cancel();
    });

    it("rejects at once when the viewer has already left", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(openStream(new URL(`${baseUrl()}/stream`), controller.signal)).rejects.toThrow();
    });

    it("checks the certificate of an https camera unless ignoreTls is set", async () => {
        // a request that fails at once, so only the options it was opened with matter
        const requestSpy = vi.spyOn(https, "request").mockImplementation(() => {
            const request = Object.assign(new EventEmitter(), {
                destroy: vi.fn(),
                end: () => queueMicrotask(() => request.emit("error", new Error("refused"))),
            });
            return request as unknown as http.ClientRequest;
        });
        try {
            const url = new URL("https://cam.lan/stream");
            await expect(openStream(url, new AbortController().signal)).rejects.toThrow("refused");
            await expect(openStream(url, new AbortController().signal, { ignoreTls: true })).rejects.toThrow("refused");

            const options = requestSpy.mock.calls.map((call) => call[1] as https.RequestOptions);
            expect(options.map((option) => option.rejectUnauthorized)).toEqual([true, false]);
        } finally {
            requestSpy.mockRestore();
        }
    });

    it("gives up when the camera never answers", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
            const pending = openStream(new URL(`${baseUrl()}/silent`), new AbortController().signal);
            const assertion = expect(pending).rejects.toThrow(/Timed out connecting/);
            // let the request reach the server before the timer fires
            await vi.advanceTimersByTimeAsync(10_001);
            await assertion;
        } finally {
            vi.useRealTimers();
        }
    });
});
