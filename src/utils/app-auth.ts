import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { isAllowedHost, isAuthorized } from "@/utils/auth";
import { isAuthEnabled } from "@/utils/env";

function signInPath(callbackUrl: string) {
    return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

function toQueryString(searchParams: Record<string, string | string[] | undefined> = {}) {
    const query = new URLSearchParams(
        Object.entries(searchParams).flatMap(([key, value]) =>
            [value].flat().map((item): [string, string] => [key, item as string])
        )
    ).toString();
    return query ? `?${query}` : "";
}

// Server components have no req/res, so the request is read through next/headers.
// Call this before loading anything private for the page.
export async function requirePageAuth(pathname: string, searchParams?: Record<string, string | string[] | undefined>) {
    const requestHeaders = await headers();
    if (!isAllowedHost(requestHeaders.get("host"))) {
        notFound();
    }
    if (!(await isAuthorized({ headers: requestHeaders, cookies: await cookies() }))) {
        redirect(signInPath(`${pathname}${toQueryString(searchParams)}`));
    }
}

export function withRouteAuth<Context = unknown>(
    handler: (req: NextRequest, context?: Context) => Response | Promise<Response>
) {
    return async function authenticatedRoute(req: NextRequest, context?: Context) {
        if (!isAllowedHost(req.headers.get("host"))) {
            return new NextResponse(null, { status: 404 });
        }
        if (!(await isAuthorized(req))) {
            const url = new URL(req.url);
            // Same-origin by construction, so this cannot be used as an open redirect
            const callbackUrl = `${url.pathname}${url.search}`;
            return NextResponse.redirect(new URL(signInPath(callbackUrl), req.url));
        }
        const response = await handler(req, context);
        if (isAuthEnabled()) {
            response.headers.set("Cache-Control", "private, no-store");
        }
        return response;
    };
}
