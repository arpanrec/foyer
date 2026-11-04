// Next.js replaces process.env.NEXT_PUBLIC_* with its build-time value only when it is written with a dot, and
// noPropertyAccessFromIndexSignature allows the dot only for declared variables, so these are declared here.
declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_VERSION?: string;
        NEXT_PUBLIC_REVISION?: string;
        NEXT_PUBLIC_BUILDTIME?: string;
        NEXT_RUNTIME?: string;
    }
}
