// CodeRabbit evaluates this file on its servers. Only `@coderabbitai/config` and relative files may be imported there,
// and Node.js built-ins are rejected. A committed `.coderabbit.yaml` would take precedence over this file, so the
// repository has none.
import { defineConfig } from "@coderabbitai/config";

// Joins the lines of one instruction into a single paragraph
const text = (...lines: string[]) => lines.join(" ");

const config = defineConfig({
    language: "en-US",
    early_access: false,
    reviews: {
        profile: "chill",
        request_changes_workflow: false,
        high_level_summary: true,
        poem: false,
        review_status: true,
        collapse_walkthrough: true,
        sequence_diagrams: false,
        estimate_code_review_effort: false,
        auto_review: {
            enabled: true,
            drafts: false,
            base_branches: ["main", "dev"],
        },
        path_filters: [
            "!pnpm-lock.yaml",
            "!public/locales/!(en)/**",
            "!coverage/**",
            "!.next/**",
            "!dist/**",
            "!docs/dist/**",
            "!docs/.astro/**",
        ],
        path_instructions: [
            {
                path: "src/**/*.{ts,tsx}",
                instructions: text(
                    "The project uses strict TypeScript. Flag `any`, `@ts-` comments and non-null assertions that no",
                    "length check or loop bound guarantees. Index and record lookups are `T | undefined`, optional",
                    "members that may be set to `undefined` are written `prop?: T | undefined`, index-signature reads",
                    'use `obj["key"]`, and unused parameters start with `_`. Imports from `src` use the `@/` alias.'
                ),
            },
            {
                path: "src/**",
                instructions: text(
                    "Server code logs through `createLogger(label)` from `@/utils/logger` and never calls `console.*`.",
                    "Only browser code uses `console`. Check that the log level fits: `error` when an upstream call or",
                    "Foyer itself failed, `warn` for bad config or a bad request or anything skipped because of one,",
                    "`info` for one-time lifecycle events, `debug` for detail. A `warn` or `error` names where it",
                    "comes from, such as the widget type, service and group, or the value that was wrong. Environment",
                    "variables are read with `getEnv(name)` from `@/utils/env`."
                ),
            },
            {
                path: "src/app/**",
                instructions: text(
                    "This is the Next.js App Router. A change must not add a `src/pages/` route, a middleware file or",
                    "a `.js` or `.jsx` source file. An API endpoint is a short `route.ts` plus a `handler.ts` that",
                    "exports `withAuth(handler)`. Credentials must never reach the browser; every call to a backend",
                    "service goes through the server."
                ),
            },
            {
                path: "src/widgets/**",
                instructions: text(
                    "Service widgets go through the services proxy. Check that a widget option reaches the browser",
                    "only when it is whitelisted and holds no secret, that endpoints are anchored (`^...$`) in",
                    "`allowedEndpoints`, and that a widget does not make write calls or let the user configure the",
                    "refresh interval."
                ),
            },
            {
                path: "src/components/widgets/**",
                instructions: text(
                    "Information widgets read private options on the server with `getPrivateWidgetOptions`. Client",
                    "components import `useTranslation` from `next-i18next/pages`."
                ),
            },
            {
                path: "**/*.test.{ts,tsx}",
                instructions: text(
                    "Tests sit next to the file they test. Component tests start with `// @vitest-environment jsdom`.",
                    "In tests `t(key)` returns the key, so assert on keys and plain numbers. A test that mocks",
                    "`@/utils/logger` gives the mock `debug`, `info`, `warn` and `error`. Changed lines should be",
                    "covered, branches included."
                ),
            },
            {
                path: "public/locales/en/common.json",
                instructions: "Only English strings are edited here; the other locales come from Crowdin.",
            },
            {
                path: "docs/**",
                instructions: text(
                    "Docs show config as JSONC with quoted keys, and describe only what is present now, without",
                    'history such as "previously" or "no longer". Check that examples match the option names in the',
                    "code."
                ),
            },
            {
                path: ".github/workflows/**",
                instructions: text(
                    "Every job needs an `if:` that starts with",
                    "`github.server_url == 'https://github.com' && github.repository == 'arpanrec/foyer'`. Pin actions",
                    "to a commit SHA. A workflow that runs a `package.json` script must use a script that exists."
                ),
            },
        ],
        tools: {
            gitleaks: { enabled: false },
            markdownlint: { enabled: false },
        },
    },
    chat: {
        auto_reply: true,
    },
});

export default config;
