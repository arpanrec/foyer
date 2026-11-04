import { getEnv, isAuthEnabled } from "@/utils/env";

export const MIN_AUTH_SECRET_LENGTH = 32;

// Checks the auth environment and throws a message naming what is wrong. Returns the parsed external URL when auth
// is enabled, and undefined when it is not. Call it after applyNextAuthEnv().
export function validateAuthEnv(): URL | undefined {
    if (!isAuthEnabled()) return undefined;

    const authUrl = process.env.NEXTAUTH_URL;
    if (!authUrl) {
        throw new Error("Foyer auth is enabled but FOYER_EXTERNAL_URL (or NEXTAUTH_URL) is missing.");
    }

    let parsedAuthUrl: URL;
    try {
        parsedAuthUrl = new URL(authUrl);
    } catch {
        throw new Error("FOYER_EXTERNAL_URL (or NEXTAUTH_URL) must be an absolute HTTP(S) URL.");
    }

    if (
        !["http:", "https:"].includes(parsedAuthUrl.protocol) ||
        parsedAuthUrl.username ||
        parsedAuthUrl.password ||
        parsedAuthUrl.search ||
        parsedAuthUrl.hash
    ) {
        throw new Error(
            "FOYER_EXTERNAL_URL (or NEXTAUTH_URL) must be an absolute HTTP(S) URL without credentials, query, or fragment."
        );
    }

    const issuer = getEnv("OIDC_ISSUER");
    const clientId = getEnv("OIDC_CLIENT_ID");
    const clientSecret = getEnv("OIDC_CLIENT_SECRET");
    const secret = process.env.NEXTAUTH_SECRET;

    if (issuer && clientId && clientSecret) {
        if (!secret) {
            throw new Error("OIDC auth is enabled but required settings are missing.");
        }
    } else if (issuer || clientId || clientSecret) {
        throw new Error("OIDC auth is enabled but required settings are missing.");
    } else if (!getEnv("AUTH_PASSWORD") || !secret) {
        throw new Error("Password auth is enabled but required settings are missing.");
    }

    if (secret && secret.length < MIN_AUTH_SECRET_LENGTH) {
        throw new Error(
            `FOYER_AUTH_SECRET (or NEXTAUTH_SECRET) must be at least ${MIN_AUTH_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 32`
        );
    }

    return parsedAuthUrl;
}
