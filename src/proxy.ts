import { getToken, type GetTokenParams } from "next-auth/jwt";
import { NextResponse } from "next/server";

import { isAllowedHost, secureCookie } from "@/utils/auth";
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

export async function proxy(req: ProxyRequest) {
    if (!isAllowedHost(req.headers.get("host"))) {
        return NextResponse.json({ error: "Host validation failed. See logs for more details." }, { status: 400 });
    }

    const url = new URL(req.url);
    const { pathname, search } = url;
    const isPublicAuthPath = pathname.startsWith("/api/healthcheck") || pathname === "/api/config/custom.css";
    if (authEnabled && !isPublicAuthPath) {
        // The MCP API handler authorizes both bearer tokens and Foyer sessions.
        if (pathname === "/api/mcp") {
            return withPrivateCache(NextResponse.next());
        }

        const token = await getToken({
            req: req as GetTokenParams["req"],
            secret: authSecret,
            secureCookie: secureCookie(),
        });
        if (!token) {
            const signInUrl = new URL("/auth/signin", req.url);
            // Same-origin by construction, so this cannot be used as an open redirect
            signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
            return withPrivateCache(NextResponse.redirect(signInUrl));
        }
    }

    return withPrivateCache(NextResponse.next());
}

export const config = {
    // Protect all app and API routes; allow Next.js internals, public assets, auth pages, and NextAuth endpoints.
    matcher: [
        "/",
        "/((?!_next/static|_next/image|favicon.ico|favicon-|foyer.ico|apple-touch-icon|safari-pinned-tab|robots.txt|manifest.json|sitemap.xml|icons/|api/auth|auth/).*)",
    ],
};
