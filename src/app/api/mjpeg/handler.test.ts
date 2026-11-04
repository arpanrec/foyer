import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getServiceWidget, openStream } = vi.hoisted(() => ({ getServiceWidget: vi.fn(), openStream: vi.fn() }));
const { logger } = vi.hoisted(() => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/config/service-helpers", () => ({ default: getServiceWidget }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));
vi.mock("@/utils/mjpeg", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/utils/mjpeg")>()),
    openStream,
}));

import handler from "@/app/api/mjpeg/handler";

function request(query = "group=Cameras&service=Door&index=0", method = "GET") {
    return new NextRequest(`http://localhost:3000/api/mjpeg?${query}`, { method });
}

function streamOf(text: string) {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
        },
    });
}

describe("app/api/mjpeg/handler", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllEnvs());

    it("streams the camera found in the service's config, and passes the config's service to the lookup", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "http://cam.lan/stream" });
        openStream.mockResolvedValue({
            status: 200,
            contentType: "multipart/x-mixed-replace; boundary=frame",
            body: streamOf("frame"),
        });

        const res = await handler(request());

        expect(getServiceWidget).toHaveBeenCalledWith("Cameras", "Door", "0");
        expect(openStream.mock.calls[0]![0].href).toBe("http://cam.lan/stream");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("multipart/x-mixed-replace; boundary=frame");
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(await res.text()).toBe("frame");
    });

    it("checks the camera's certificate unless the widget sets ignoreTls", async () => {
        openStream.mockImplementation(async () => ({ status: 200, contentType: "image/jpeg", body: streamOf("x") }));

        for (const ignoreTls of [undefined, false, true, "true"]) {
            getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "https://cam.lan/stream", ignoreTls });
            expect((await handler(request())).status).toBe(200);
        }

        expect(openStream.mock.calls.map((call) => call[2])).toEqual([
            { ignoreTls: false },
            { ignoreTls: false },
            { ignoreTls: true },
            { ignoreTls: true },
        ]);
    });

    it("ignores any address in the request", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "http://cam.lan/stream" });
        openStream.mockResolvedValue({ status: 200, contentType: "image/jpeg", body: streamOf("x") });

        await handler(request("group=a&service=b&index=0&stream=http://evil.example/x&url=http://evil.example/y"));

        expect(openStream.mock.calls[0]![0].href).toBe("http://cam.lan/stream");
    });

    it("answers 404 for a service without an mjpeg widget", async () => {
        getServiceWidget.mockResolvedValue({ type: "glances" });
        expect((await handler(request())).status).toBe(404);

        getServiceWidget.mockResolvedValue(undefined);
        expect((await handler(request())).status).toBe(404);
        expect(openStream).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("opens a stream given as a path on the address the dashboard is opened at", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "localhost:3000");
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });
        openStream.mockResolvedValue({ status: 200, contentType: "image/jpeg", body: streamOf("x") });

        const req = new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=0", {
            headers: { host: "localhost:3000" },
        });

        expect((await handler(req)).status).toBe(200);
        expect(openStream.mock.calls[0]![0].href).toBe("http://localhost:3000/webcam/?action=stream");
    });

    it("opens a path on the address the browser used when a proxy ended TLS in front of Foyer", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "dash.example.com");
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });
        openStream.mockResolvedValue({ status: 200, contentType: "image/jpeg", body: streamOf("x") });

        const req = new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=0", {
            headers: { host: "dash.example.com", "x-forwarded-proto": "https, http" },
        });

        expect((await handler(req)).status).toBe(200);
        expect(openStream.mock.calls[0]![0].href).toBe("https://dash.example.com/webcam/?action=stream");
    });

    it("refuses a stream path when FOYER_ALLOWED_HOSTS is *, since the client would choose the host", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "*");
        try {
            getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });
            const req = new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=0", {
                headers: { host: "evil.example" },
            });

            expect((await handler(req)).status).toBe(404);
            expect(openStream).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalled();
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it("refuses a stream path for a request without a Host header", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });

        expect((await handler(request())).status).toBe(404);
        expect(openStream).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("opens a stream path on FOYER_EXTERNAL_URL when it is set, whatever the Host header says", async () => {
        vi.stubEnv("FOYER_ALLOWED_HOSTS", "*");
        vi.stubEnv("FOYER_EXTERNAL_URL", "https://dash.example.com/");
        try {
            getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });
            openStream.mockResolvedValue({ status: 200, contentType: "image/jpeg", body: streamOf("x") });
            const req = new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=0", {
                headers: { host: "evil.example" },
            });

            expect((await handler(req)).status).toBe(200);
            expect(openStream.mock.calls[0]![0].href).toBe("https://dash.example.com/webcam/?action=stream");
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it("answers 404 when the stream is missing or not an http(s) URL", async () => {
        for (const stream of [undefined, "", "not a url", "file:///etc/passwd", "ftp://cam.lan/x"]) {
            getServiceWidget.mockResolvedValue({ type: "mjpeg", stream });
            expect((await handler(request())).status).toBe(404);
        }
        expect(openStream).not.toHaveBeenCalled();
    });

    it("answers 502 and logs an error when the camera answers badly or cannot be reached", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "http://cam.lan/stream" });

        const cancel = vi.fn();
        openStream.mockResolvedValueOnce({
            status: 401,
            contentType: "text/html",
            body: { cancel } as unknown as ReadableStream<Uint8Array>,
        });
        expect((await handler(request())).status).toBe(502);
        expect(cancel).toHaveBeenCalled();

        openStream.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        expect((await handler(request())).status).toBe(502);
        expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it("names a missing content type when the camera answers without one", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "http://cam.lan/stream" });
        const cancel = vi.fn();
        openStream.mockResolvedValueOnce({
            status: 200,
            contentType: "",
            body: { cancel } as unknown as ReadableStream<Uint8Array>,
        });

        expect((await handler(request())).status).toBe(502);
        expect(cancel).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.any(String), "Door", "Cameras", 200, "no content type");
    });

    it("answers 405 for any method but GET", async () => {
        expect((await handler(request(undefined, "POST"))).status).toBe(405);
        expect(getServiceWidget).not.toHaveBeenCalled();
    });

    it("answers 404 for a stream path when FOYER_EXTERNAL_URL is not a URL", async () => {
        vi.stubEnv("FOYER_EXTERNAL_URL", "not a url");
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "/webcam/?action=stream" });

        expect((await handler(request())).status).toBe(404);
        expect(openStream).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("answers 499 without logging an error when the viewer left while the stream was opening", async () => {
        getServiceWidget.mockResolvedValue({ type: "mjpeg", stream: "http://cam.lan/stream" });
        const controller = new AbortController();
        openStream.mockImplementationOnce(async () => {
            controller.abort();
            throw new Error("socket hang up");
        });
        const req = new NextRequest("http://localhost:3000/api/mjpeg?group=Cameras&service=Door&index=0", {
            signal: controller.signal,
        });

        expect((await handler(req)).status).toBe(499);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("looks the service up with undefined when the request names no group, service or index", async () => {
        getServiceWidget.mockResolvedValue(undefined);

        expect((await handler(request(""))).status).toBe(404);
        expect(getServiceWidget).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
});
