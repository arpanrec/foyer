export function getEnv(name: string): string | undefined {
    return process.env[`FOYER_${name}`];
}

export function isAuthEnabled() {
    return getEnv("AUTH_ENABLED") === "true";
}

// Frozen at module load, so map them before anything imports it
export function applyNextAuthEnv() {
    const authSecret = getEnv("AUTH_SECRET");
    const externalUrl = getEnv("EXTERNAL_URL");
    if (!process.env.NEXTAUTH_SECRET && authSecret) {
        process.env.NEXTAUTH_SECRET = authSecret;
    }
    if (!process.env.NEXTAUTH_URL && externalUrl) {
        process.env.NEXTAUTH_URL = externalUrl;
    }
}
