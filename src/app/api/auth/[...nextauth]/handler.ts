import { createHash, timingSafeEqual } from "node:crypto";

import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAllowedHost } from "@/utils/auth";
import { applyNextAuthEnv, getEnv, isAuthEnabled } from "@/utils/env";
import createLogger from "@/utils/logger";

const MIN_AUTH_SECRET_LENGTH = 32;

// Claims the OIDC profile mapping reads; providers differ in which of them they send
type OidcProfile = {
    sub?: string;
    id?: string;
    user_id?: string;
    uid?: string;
    email?: string;
    name?: string;
    preferred_username?: string;
    nickname?: string;
    picture?: string;
};

const authEnabled = isAuthEnabled();
const issuer = getEnv("OIDC_ISSUER");
const clientId = getEnv("OIDC_CLIENT_ID");
const clientSecret = getEnv("OIDC_CLIENT_SECRET");
const foyerAuthPassword = getEnv("AUTH_PASSWORD");
const foyerAuthPasswordDigest = foyerAuthPassword
    ? createHash("sha256").update(foyerAuthPassword, "utf8").digest()
    : null;

// Also done in instrumentation.ts
applyNextAuthEnv();

const defaultScope = getEnv("OIDC_SCOPE") || "openid email profile";
const cleanedIssuer = issuer ? issuer.replace(/\/+$/, "") : issuer;
const hasOidcConfig = Boolean(issuer && clientId && clientSecret);
const hasAnyOidcConfig = Boolean(issuer || clientId || clientSecret);
let parsedAuthUrl;

if (authEnabled) {
    if (!process.env.NEXTAUTH_URL) {
        throw new Error("Foyer auth is enabled but FOYER_EXTERNAL_URL (or NEXTAUTH_URL) is missing.");
    }

    try {
        parsedAuthUrl = new URL(process.env.NEXTAUTH_URL);
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

    if (hasOidcConfig) {
        if (!process.env.NEXTAUTH_SECRET) {
            throw new Error("OIDC auth is enabled but required settings are missing.");
        }
    } else if (hasAnyOidcConfig) {
        throw new Error("OIDC auth is enabled but required settings are missing.");
    } else if (!foyerAuthPassword || !process.env.NEXTAUTH_SECRET) {
        throw new Error("Password auth is enabled but required settings are missing.");
    }

    if (process.env.NEXTAUTH_SECRET.length < MIN_AUTH_SECRET_LENGTH) {
        throw new Error(
            `FOYER_AUTH_SECRET (or NEXTAUTH_SECRET) must be at least ${MIN_AUTH_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 32`
        );
    }
}

// Give fail2ban / CrowdSec etc something to match on
function logFailedPasswordSignIn() {
    createLogger("nextauth").warn("Failed password sign-in attempt");
}

function logNextAuthError(code: string, metadata: unknown) {
    const error =
        metadata instanceof Error ? metadata : (metadata as { error?: { message?: string } } | undefined)?.error;

    if (error?.message) {
        createLogger("nextauth").error("%s: %s", code, error.message);
    } else {
        createLogger("nextauth").error("%s", code);
    }
}

let providers: AuthOptions["providers"] = [];
if (authEnabled) {
    if (hasOidcConfig) {
        providers = [
            {
                id: "foyer-oidc",
                name: getEnv("OIDC_NAME") || "Foyer OIDC",
                type: "oauth",
                idToken: true,
                checks: ["pkce", "state", "nonce"],
                issuer: cleanedIssuer,
                wellKnown: `${cleanedIssuer}/.well-known/openid-configuration`,
                clientId,
                clientSecret,
                authorization: {
                    params: {
                        scope: defaultScope,
                    },
                },
                profile(profile: OidcProfile) {
                    return {
                        id: (profile.sub ?? profile.id ?? profile.user_id ?? profile.uid ?? profile.email) as string,
                        name: profile.name ?? profile.preferred_username ?? profile.nickname ?? profile.email,
                        email: profile.email ?? null,
                        image: profile.picture ?? null,
                    };
                },
            },
        ];
    } else {
        providers = [
            CredentialsProvider({
                name: "Password",
                credentials: {
                    password: { label: "Password", type: "password" },
                },
                async authorize(credentials) {
                    const provided = credentials?.password;
                    if (!foyerAuthPasswordDigest || typeof provided !== "string") {
                        logFailedPasswordSignIn();
                        return null;
                    }
                    const providedDigest = createHash("sha256").update(provided, "utf8").digest();
                    const isMatch = timingSafeEqual(providedDigest, foyerAuthPasswordDigest);
                    if (!isMatch) {
                        logFailedPasswordSignIn();
                        return null;
                    }
                    return {
                        id: "foyer",
                        name: "Foyer",
                    };
                },
            }),
        ];
    }
}

export const authOptions: AuthOptions = {
    providers,
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    useSecureCookies: parsedAuthUrl?.protocol === "https:",
    pages: {
        signIn: "/auth/signin",
    },
    logger: {
        error: logNextAuthError,
        warn: (code) => createLogger("nextauth").warn("%s", code),
        debug: (code) => createLogger("nextauth").debug("%s", code),
    },
    events: {
        signIn: async ({ account }) => {
            createLogger("nextauth").debug("Sign in via provider '%s'", account?.provider ?? "unknown");
        },
        signOut: async () => {
            createLogger("nextauth").debug("Sign out");
        },
    },
};

const nextAuthHandler = NextAuth(authOptions);

async function handler(req: ApiRequest, res: ApiResponse) {
    // Just pass empty session if auth not enabled
    if (!authEnabled) {
        return res.status(200).json({});
    }

    return nextAuthHandler(req, res);
}

export default withAllowedHost(handler);
