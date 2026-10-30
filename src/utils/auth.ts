import type { IncomingHttpHeaders } from "node:http";

import { getToken } from "next-auth/jwt";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { getEnv, isAuthEnabled } from "@/utils/env";

type ApiHandler = (req: ApiRequest, res: ApiResponse) => unknown;

type GetTokenRequest = Parameters<typeof getToken>[0]["req"];

// A Node request, a NextRequest, or anything with Web `headers` and a `cookies` store (`getAll()` or a plain object)
type AuthRequest =
    | GetTokenRequest
    | ApiRequest
    | {
          headers: Headers | IncomingHttpHeaders;
          cookies: Record<string, string | undefined> | { getAll(): { name: string; value: string }[] };
      };

export function isAllowedHost(host?: string | null) {
    const allowedHostsEnv = getEnv("ALLOWED_HOSTS");
    if (allowedHostsEnv === "*") return true;
    const port = process.env.PORT || 3000;
    const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].concat(
        allowedHostsEnv ? allowedHostsEnv.split(",") : []
    );
    if (host && allowedHosts.includes(host)) return true;
    console.error(
        `Host validation failed for: ${host}. Hint: Set the FOYER_ALLOWED_HOSTS environment variable to allow requests from this host / port.`
    );
    return false;
}

export function withAllowedHost(handler: ApiHandler) {
    return async function hostCheckedHandler(req: ApiRequest, res: ApiResponse) {
        if (!isAllowedHost(req.headers?.host)) {
            return res.status(400).json({ error: "Host validation failed. See logs for more details." });
        }
        return handler(req, res);
    };
}

// Match NextAuth, which picks the cookie name from the parsed URL protocol
export function secureCookie() {
    try {
        return new URL(process.env.NEXTAUTH_URL || getEnv("EXTERNAL_URL") || "").protocol === "https:";
    } catch {
        return false;
    }
}

// Takes a Node request, a NextRequest, or anything with Web `headers` and a `cookies` store
export async function isAuthorized(req: AuthRequest) {
    if (!isAuthEnabled()) return true;

    return Boolean(
        await getToken({
            // getToken only reads `headers` and `cookies`, which every AuthRequest member carries
            req: req as GetTokenRequest,
            secret: process.env.NEXTAUTH_SECRET || getEnv("AUTH_SECRET"),
            secureCookie: secureCookie(),
        })
    );
}

async function authorized(req: ApiRequest, res: ApiResponse) {
    if (!isAuthEnabled()) return true;

    res.setHeader("Cache-Control", "private, no-store");
    return isAuthorized(req);
}

export function withAuth(handler: ApiHandler, { public: isPublic }: { public?: (req: ApiRequest) => boolean } = {}) {
    return withAllowedHost(async function authenticatedHandler(req: ApiRequest, res: ApiResponse) {
        if (!isPublic?.(req) && !(await authorized(req, res))) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        return handler(req, res);
    });
}
