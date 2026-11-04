import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

import { foyerUserAgent } from "@/utils/proxy/user-agent";

const CONNECT_TIMEOUT_MS = 10_000;
// A live stream sends a frame every fraction of a second, so a silent connection is a dead one
const IDLE_TIMEOUT_MS = 30_000;

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type UpstreamStream = { status: number; contentType: string; body: ReadableStream<Uint8Array> };

export type StreamOptions = {
    // skip the TLS certificate check of an https camera, for one with a self-signed certificate
    ignoreTls?: boolean | undefined;
};

// One answer from the camera, with the address a redirect points to
type Answer = UpstreamStream & { location: string | undefined };

// Raster formats a camera sends as a single frame. image/svg+xml is left out on purpose: the route is same-origin, so
// an SVG opened directly would run its script on Foyer's origin.
const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp"]);

// A multipart stream or a raster image; anything else, SVG included, is refused
export function isStreamContentType(contentType: string) {
    const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    return type === "multipart/x-mixed-replace" || RASTER_TYPES.has(type);
}

// Opens the camera's stream and hands the body on without buffering it. A redirect is followed up to MAX_REDIRECTS
// hops. user:password stays with a redirect on the same host, unless it would drop from https to http, and is not given
// to another host. Aborting `signal` (the viewer left) closes the connection to the camera. The TLS certificate of an
// https camera is checked unless `options.ignoreTls` is set, and user:password in the URL becomes basic auth.
export async function openStream(url: URL, signal: AbortSignal, options: StreamOptions = {}): Promise<UpstreamStream> {
    let current = url;
    for (let hops = 0; ; hops++) {
        const { location, ...upstream } = await openOnce(current, signal, options);
        if (!REDIRECT_STATUSES.has(upstream.status) || !location) return upstream;

        await upstream.body.cancel();
        if (hops >= MAX_REDIRECTS) throw new Error(`More than ${MAX_REDIRECTS} redirects`);

        const next = new URL(location, current);
        if (next.protocol !== "http:" && next.protocol !== "https:")
            throw new Error("Redirected to a non-http address");
        // a relative address keeps the password on its own, and an absolute one on the same host has to be given it,
        // unless that would send it over plain http after an https hop
        const downgrade = current.protocol === "https:" && next.protocol === "http:";
        if (!next.username && !next.password && next.host === current.host && !downgrade) {
            next.username = current.username;
            next.password = current.password;
        }
        current = next;
    }
}

function openOnce(url: URL, signal: AbortSignal, { ignoreTls = false }: StreamOptions): Promise<Answer> {
    return new Promise((resolve, reject) => {
        const requestFn = url.protocol === "https:" ? https.request : http.request;
        const request = requestFn(url, {
            method: "GET",
            headers: { "User-Agent": foyerUserAgent(url), Accept: "multipart/x-mixed-replace, image/*" },
            ...(url.protocol === "https:" ? { rejectUnauthorized: !ignoreTls } : {}),
        });

        const abort = () => request.destroy();
        if (signal.aborted) abort();
        signal.addEventListener("abort", abort, { once: true });

        const connectTimer = setTimeout(
            () => request.destroy(new Error("Timed out connecting to the stream")),
            CONNECT_TIMEOUT_MS
        );

        request.on("error", (error) => {
            clearTimeout(connectTimer);
            signal.removeEventListener("abort", abort);
            reject(error);
        });

        request.on("response", (response) => {
            clearTimeout(connectTimer);
            response.setTimeout(IDLE_TIMEOUT_MS, () => response.destroy(new Error("The stream went quiet")));
            response.on("close", () => signal.removeEventListener("abort", abort));
            // a stream that dies after it started has nothing left to report to
            response.on("error", () => {});
            resolve({
                status: response.statusCode ?? 502,
                contentType: String(response.headers["content-type"] ?? ""),
                location: response.headers.location,
                body: Readable.toWeb(response) as ReadableStream<Uint8Array>,
            });
        });

        request.end();
    });
}
