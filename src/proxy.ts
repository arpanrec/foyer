import { getToken, type GetTokenParams } from "next-auth/jwt";
import { NextResponse } from "next/server";

import { isAllowedHost, secureCookie } from "@/utils/auth";
import { cspHeader } from "@/utils/csp";
import { getEnv, isAuthEnabled } from "@/utils/env";

const authEnabled = isAuthEnabled();
const authSecret = process.env.NEXTAUTH_SECRET || getEnv("AUTH_SECRET");

export type ProxyRequest = {
    url: string;
    headers: {
        get(name: string): string | null;
    };
};

// Prerendered pages carry `s-maxage`, and the dashboard HTML embeds the service and
// bookmark inventory. Without this, a CDN or caching reverse proxy in front of Foyer
// would store an authenticated response and serve it to anonymous visitors.
function withPrivateCache<T extends { headers: { set(name: string, value: string): void } }>(res: T): T {
    if (authEnabled) {
        res.headers.set("Cache-Control", "private, no-store");
    }
    return res;
}

// Limits what the browser may load to Foyer's own origin, so a page never reaches for the internet
function withContentSecurityPolicy<T extends { headers: { set(name: string, value: string): void } }>(res: T): T {
    const header = cspHeader();
    if (header) res.headers.set(header.name, header.value);
    return res;
}

// These routes answer with an image, and `sendIcon` sets their policy and cache headers. Next keeps a header the
// proxy already set and drops the route's, so the page policy would replace the sandbox on an SVG, and `no-store`
// would replace the icon's `max-age`.
function isImageRoute(pathname: string): boolean {
    return (
        pathname === "/api/icon-proxy" ||
        pathname === "/api/background" ||
        pathname === "/api/icons" ||
        pathname.startsWith("/api/icons/")
    );
}

export async function proxy(req: ProxyRequest) {
    const url = new URL(req.url);
    const { pathname, search } = url;

    // The sign-in page and the NextAuth endpoints answer without a session, and carry the policy too
    if (pathname.startsWith("/auth/") || pathname.startsWith("/api/auth")) {
        return withContentSecurityPolicy(NextResponse.next());
    }

    if (!isAllowedHost(req.headers.get("host"))) {
        return withContentSecurityPolicy(
            NextResponse.json({ error: "Host validation failed. See logs for more details." }, { status: 400 })
        );
    }

    const isPublicAuthPath =
        pathname.startsWith("/api/healthcheck") ||
        pathname === "/api/config/custom.css" ||
        pathname === "/api/background";
    if (authEnabled && !isPublicAuthPath) {
        // The MCP API handler authorizes both bearer tokens and Foyer sessions.
        if (pathname === "/api/mcp") {
            return withContentSecurityPolicy(withPrivateCache(NextResponse.next()));
        }

        const token = await getToken({
            req: req as GetTokenParams["req"],
            ...(authSecret === undefined ? {} : { secret: authSecret }),
            secureCookie: secureCookie(),
        });
        if (!token) {
            const signInUrl = new URL("/auth/signin", req.url);
            // Same-origin by construction, so this cannot be used as an open redirect
            signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
            return withContentSecurityPolicy(withPrivateCache(NextResponse.redirect(signInUrl)));
        }
    }

    // An image route sets both headers itself: its own sandbox policy, and `private, max-age`, which keeps a shared
    // cache off the image and still lets the browser reuse it
    if (isImageRoute(pathname)) return NextResponse.next();

    return withContentSecurityPolicy(withPrivateCache(NextResponse.next()));
}

export const config = {
    // Every app and API route, the sign-in page and the NextAuth endpoints; Next.js internals and public assets are left out.
    // The sign-in page and NextAuth endpoints only get the Content-Security-Policy header.
    matcher: [
        "/",
        "/((?!_next/static|_next/image|favicon.ico|favicon-|foyer.ico|apple-touch-icon|safari-pinned-tab|robots.txt|manifest.json|sitemap.xml|icons/).*)",
    ],
};
