import type { NextRequest } from "next/server";

import { isAllowedHost, isAuthorized } from "@/utils/auth";
import getServiceWidget from "@/utils/config/service-helpers";
import { getEnv, isAuthEnabled } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";
import { isStreamContentType, openStream } from "@/utils/mjpeg";

const logger = createLogger("mjpeg");

// The address the dashboard is opened at, for a stream given as a path. FOYER_EXTERNAL_URL wins. Without it the Host
// header is used only when FOYER_ALLOWED_HOSTS lists the hosts, since with "*" any client could choose the host the
// server then requests. Behind a reverse proxy that ends TLS, Next sees plain http, so the scheme comes from
// X-Forwarded-Proto when the proxy sends it.
function pageOrigin(req: NextRequest) {
    const external = getEnv("EXTERNAL_URL");
    if (external) {
        try {
            return new URL(external).origin;
        } catch {
            return undefined;
        }
    }
    // the handler's host check refuses a request without a Host header unless FOYER_ALLOWED_HOSTS is "*"
    const host = req.headers.get("host");
    if (!host || getEnv("ALLOWED_HOSTS") === "*") return undefined;
    const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const protocol = forwarded === "http" || forwarded === "https" ? forwarded : req.nextUrl.protocol.slice(0, -1);
    return `${protocol}://${host}`;
}

function fail(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

// Streams a camera for an mjpeg widget. The address comes from the service's config, never from the request, so this
// cannot be pointed at other hosts, and the browser never learns it (it may carry a password).
export default async function handler(req: NextRequest) {
    // src/proxy.ts already rejects a bad host and redirects a request without a session to the sign-in page before this
    // runs, so these checks only matter when the handler is reached without the proxy. They answer with JSON errors,
    // never a redirect.
    if (!isAllowedHost(req.headers.get("host"))) {
        return fail(400, "Host validation failed. See logs for more details.");
    }
    if (isAuthEnabled() && !(await isAuthorized(req))) {
        const res = fail(401, "Unauthorized");
        res.headers.set("Cache-Control", "private, no-store");
        return res;
    }
    if (req.method !== "GET") return fail(405, "Method not allowed");

    const params = req.nextUrl.searchParams;
    const group = params.get("group") ?? undefined;
    const service = params.get("service") ?? undefined;
    const index = params.get("index") ?? undefined;

    const widget = await getServiceWidget<{ stream?: unknown; ignoreTls?: unknown }>(group, service, index);
    if (widget?.type !== "mjpeg") {
        logger.warn('No mjpeg widget for service "%s" in group "%s" (index %s)', service, group, index);
        return fail(404, "Unknown mjpeg widget");
    }

    let url: URL;
    try {
        const stream = String(widget.stream ?? "");
        // a path such as /webcam/?action=stream is relative to the address the dashboard is opened at
        if (stream.startsWith("/")) {
            const origin = pageOrigin(req);
            if (!origin) {
                logger.warn(
                    'The mjpeg widget of service "%s" in group "%s" has a stream path, which needs FOYER_EXTERNAL_URL or a FOYER_ALLOWED_HOSTS list without "*"',
                    service,
                    group
                );
                return fail(404, "No stream configured");
            }
            url = new URL(stream, origin);
        } else {
            url = new URL(stream);
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http or https");
    } catch {
        logger.warn('The mjpeg widget of service "%s" in group "%s" has no valid http(s) stream URL', service, group);
        return fail(404, "No stream configured");
    }

    try {
        const ignoreTls = widget.ignoreTls === true || widget.ignoreTls === "true";
        const upstream = await openStream(url, req.signal, { ignoreTls });
        if (upstream.status !== 200 || !isStreamContentType(upstream.contentType)) {
            logger.error(
                'The stream of service "%s" in group "%s" answered HTTP %d (%s)',
                service,
                group,
                upstream.status,
                upstream.contentType || "no content type"
            );
            await upstream.body.cancel();
            return fail(502, "The stream is not available");
        }

        return new Response(upstream.body, {
            headers: {
                "Content-Type": upstream.contentType,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (e) {
        if (req.signal.aborted) return new Response(null, { status: 499 });
        logger.error('Could not open the stream of service "%s" in group "%s": %s', service, group, errorMessage(e));
        return fail(502, "The stream is not available");
    }
}
