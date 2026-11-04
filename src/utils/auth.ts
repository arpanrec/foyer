import type { IncomingHttpHeaders } from "node:http";

import { getToken } from "next-auth/jwt";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { getEnv, isAuthEnabled } from "@/utils/env";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

const logger = createLogger("auth");

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

/**
 * Checks a request's Host header against localhost and `FOYER_ALLOWED_HOSTS`, and logs a hint when it is rejected.
 *
 * @param host The Host header value.
 * @returns True when the host may use the server.
 */
export function isAllowedHost(host?: string | null) {
    const allowedHostsEnv = getEnv("ALLOWED_HOSTS");
    if (allowedHostsEnv === "*") return true;
    const port = process.env["PORT"] || 3000;
    const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].concat(
        allowedHostsEnv
            ? allowedHostsEnv
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
            : []
    );
    if (host && allowedHosts.includes(host)) return true;
    logger.error(
        "Host validation failed for: %s. Hint: Set the FOYER_ALLOWED_HOSTS environment variable to allow requests from this host / port.",
        host
    );
    return false;
}

/**
 * Wraps an API handler so a request from a host that is not allowed gets a 400 response.
 *
 * @param handler The handler to protect.
 * @returns The wrapped handler.
 */
export function withAllowedHost(handler: ApiHandler) {
    return async function hostCheckedHandler(req: ApiRequest, res: ApiResponse) {
        if (!isAllowedHost(req.headers?.host)) {
            return res.status(400).json({ error: "Host validation failed. See logs for more details." });
        }
        return handler(req, res);
    };
}

/**
 * Tells whether session cookies are secure, which follows the protocol of the external URL as NextAuth does.
 *
 * @returns True when the external URL is https.
 */
export function secureCookie() {
    const externalUrl = process.env["NEXTAUTH_URL"] || getEnv("EXTERNAL_URL") || "";
    try {
        return new URL(externalUrl).protocol === "https:";
    } catch {
        if (externalUrl) {
            warnOnce(
                logger,
                'FOYER_EXTERNAL_URL "%s" is not a valid URL; session cookies are not marked Secure',
                externalUrl
            );
        }
        return false;
    }
}

/**
 * Tells whether a request carries a valid session token. Always true when authentication is off.
 *
 * @param req A Node request, a NextRequest, or anything with Web `headers` and a `cookies` store.
 * @returns True when the request may proceed.
 */
export async function isAuthorized(req: AuthRequest) {
    if (!isAuthEnabled()) return true;

    const secret = process.env.NEXTAUTH_SECRET || getEnv("AUTH_SECRET");
    return Boolean(
        await getToken({
            // getToken only reads `headers` and `cookies`, which every AuthRequest member carries
            req: req as GetTokenRequest,
            ...(secret === undefined ? {} : { secret }),
            secureCookie: secureCookie(),
        })
    );
}

/**
 * Authorizes an API request and marks the response as not cacheable when authentication is on.
 *
 * @param req The incoming API request.
 * @param res The API response.
 * @returns True when the request may proceed.
 */
async function authorized(req: ApiRequest, res: ApiResponse) {
    if (!isAuthEnabled()) return true;

    res.setHeader("Cache-Control", "private, no-store");
    return isAuthorized(req);
}

/**
 * Wraps an API handler with the host check and the session check. A request that `public` accepts skips the session check.
 *
 * @param handler The handler to protect.
 * @param options `public` decides per request whether authentication is skipped.
 * @returns The wrapped handler.
 */
export function withAuth(handler: ApiHandler, { public: isPublic }: { public?: (req: ApiRequest) => boolean } = {}) {
    return withAllowedHost(async function authenticatedHandler(req: ApiRequest, res: ApiResponse) {
        if (!isPublic?.(req) && !(await authorized(req, res))) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        return handler(req, res);
    });
}
