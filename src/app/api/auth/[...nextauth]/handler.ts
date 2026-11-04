import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAllowedHost } from "@/utils/auth";
import { validateAuthEnv } from "@/utils/auth-config";
import { applyNextAuthEnv, getEnv, isAuthEnabled } from "@/utils/env";
import createLogger from "@/utils/logger";

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
// The configured password is hashed with scrypt and a random per-process salt, so a later sign-in attempt costs the same
// work as an attacker's guess would. The equal-length hashes also give timingSafeEqual two buffers of the same size
const passwordSalt = randomBytes(16);
const passwordHashLength = 64;
const hashPasswordSync = (password: string) => scryptSync(password, passwordSalt, passwordHashLength);
const hashPassword = (password: string) =>
    new Promise<Buffer>((resolve, reject) => {
        scrypt(password, passwordSalt, passwordHashLength, (error, derivedKey) => {
            if (error) {
                reject(error);
            } else {
                resolve(derivedKey);
            }
        });
    });
const foyerAuthPasswordHash = foyerAuthPassword ? hashPasswordSync(foyerAuthPassword) : null;

// Also done in instrumentation.ts
applyNextAuthEnv();

const defaultScope = getEnv("OIDC_SCOPE") || "openid email profile";
const cleanedIssuer = issuer ? issuer.replace(/\/+$/, "") : issuer;
const hasOidcConfig = Boolean(issuer && clientId && clientSecret);
// The same check runs at startup from instrumentation-node.ts; this one guards the module when it is imported alone
const parsedAuthUrl = validateAuthEnv();

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
                issuer: cleanedIssuer ?? "",
                wellKnown: `${cleanedIssuer}/.well-known/openid-configuration`,
                // hasOidcConfig guarantees the issuer, client ID and secret
                clientId: clientId ?? "",
                clientSecret: clientSecret ?? "",
                authorization: {
                    params: {
                        scope: defaultScope,
                    },
                },
                profile(profile: OidcProfile) {
                    return {
                        id: (profile.sub ?? profile.id ?? profile.user_id ?? profile.uid ?? profile.email) as string,
                        name: profile.name ?? profile.preferred_username ?? profile.nickname ?? profile.email ?? null,
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
                    if (!foyerAuthPasswordHash || typeof provided !== "string") {
                        logFailedPasswordSignIn();
                        return null;
                    }
                    const providedHash = await hashPassword(provided);
                    const isMatch = timingSafeEqual(providedHash, foyerAuthPasswordHash);
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
    ...(process.env.NEXTAUTH_SECRET === undefined ? {} : { secret: process.env.NEXTAUTH_SECRET }),
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
