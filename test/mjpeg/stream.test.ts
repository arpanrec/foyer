import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getServiceWidget } = vi.hoisted(() => ({ getServiceWidget: vi.fn() }));

vi.mock("@/utils/config/service-helpers", () => ({ default: getServiceWidget }));

import handler from "@/app/api/mjpeg/handler";
import { openStream } from "@/utils/mjpeg";

// The stack from compose.yaml: ffmpeg loops a video, Caddy puts basic auth in front of it
const streamUrl = process.env["MJPEG_TEST_URL"] ?? "http://127.0.0.1:8091/stream";
const user = process.env["MJPEG_TEST_USER"] ?? "cam";
const password = process.env["MJPEG_TEST_PASS"] ?? process.env["CAM_PASS"] ?? "secret";

const withCredentials = (url: string, pass = password) => {
    const result = new URL(url);
    result.username = user;
    result.password = pass;
    return result.href;
};

async function stackIsUp() {
    try {
        await fetch(streamUrl, { signal: AbortSignal.timeout(2000) }).then((res) => res.body?.cancel());
        return true;
    } catch {
        return false;
    }
}

const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);

// Reads until `frames` JPEG images have arrived, then stops the stream
async function readFrames(body: ReadableStream<Uint8Array>, frames: number) {
    const reader = body.getReader();
    let data = Buffer.alloc(0);
    const count = () => data.toString("latin1").split(JPEG_START.toString("latin1")).length - 1;
    try {
        while (count() < frames + 1) {
            const { value, done } = await reader.read();
            if (done) break;
            data = Buffer.concat([data, value]);
        }
    } finally {
        await reader.cancel().catch(() => {});
    }
    return data;
}

function request() {
    return new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=undefined", {
        headers: { host: "localhost:3000" },
    });
}

describe.skipIf(!(await stackIsUp()))("mjpeg stream behind the basic auth proxy", () => {
    afterEach(() => vi.clearAllMocks());

    it("refuses a request without credentials", async () => {
        const res = await fetch(streamUrl);
        await res.body?.cancel();
        expect(res.status).toBe(401);
        expect(res.headers.get("www-authenticate")).toMatch(/basic/i);
    });

    it("refuses a wrong password", async () => {
        const res = await fetch(streamUrl, {
            headers: { Authorization: `Basic ${Buffer.from(`${user}:not-the-password`).toString("base64")}` },
        });
        await res.body?.cancel();
        expect(res.status).toBe(401);
    });

    it("streams MJPEG frames with the right credentials", async () => {
        const res = await fetch(streamUrl, {
            headers: { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` },
        });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toMatch(/^multipart\/x-mixed-replace;\s*boundary=frame/);

        const data = await readFrames(res.body!, 3);
        expect(data.toString("latin1")).toContain("--frame");
        expect(data.includes(JPEG_START)).toBe(true);
        expect(data.includes(JPEG_END)).toBe(true);
    });

    it("opens the stream the way Foyer does, with the credentials in the URL", async () => {
        const controller = new AbortController();
        const upstream = await openStream(new URL(withCredentials(streamUrl)), controller.signal);

        expect(upstream.status).toBe(200);
        expect(upstream.contentType).toMatch(/^multipart\/x-mixed-replace/);
        expect((await readFrames(upstream.body, 3)).includes(JPEG_START)).toBe(true);
        controller.abort();
    });

    it("answers 401 to Foyer when the password in the config is wrong", async () => {
        const upstream = await openStream(new URL(withCredentials(streamUrl, "wrong")), new AbortController().signal);
        expect(upstream.status).toBe(401);
        await upstream.body.cancel();
    });

    it("serves two viewers at once, like the widget's blurred background and picture", async () => {
        const open = () => openStream(new URL(withCredentials(streamUrl)), new AbortController().signal);
        const [first, second] = await Promise.all([open(), open()]);

        const [a, b] = await Promise.all([readFrames(first.body, 3), readFrames(second.body, 3)]);
        expect(a.includes(JPEG_START)).toBe(true);
        expect(b.includes(JPEG_START)).toBe(true);
    });

    it("streams through Foyer's /api/mjpeg route without exposing the credentials", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: withCredentials(streamUrl) });

        const res = await handler(request());

        expect(getServiceWidget).toHaveBeenCalledWith("Cameras", "Door", "undefined");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toMatch(/^multipart\/x-mixed-replace/);
        expect(JSON.stringify([...res.headers])).not.toContain(password);

        const data = await readFrames(res.body!, 3);
        expect(data.includes(JPEG_START)).toBe(true);
        expect(data.includes(JPEG_END)).toBe(true);
    });

    it("answers 502 from /api/mjpeg when the config's password is wrong", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: withCredentials(streamUrl, "wrong") });
        expect((await handler(request())).status).toBe(502);
    });
});
