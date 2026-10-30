import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        globals: true,
        environment: "node",
        // Use worker threads instead of forked processes to reduce overhead and avoid noisy per-process Node warnings.
        pool: "threads",
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "json-summary"],
            include: ["src/**/*.{js,jsx,ts,tsx}"],
            exclude: [
                // Ignore build artifacts / generated reports
                ".next/**",
                "coverage/**",
                // Exclude tests and test harness code from coverage totals.
                "src/**/*.test.{js,jsx,ts,tsx}",
                "src/**/*.spec.{js,jsx,ts,tsx}",
                "src/test-utils/**",
                "src/widgets/widgets.ts",
                "src/widgets/components.ts",
                "src/skeleton/custom.js",
                "next-i18next.config.ts",
                "next.config.ts",
                "postcss.config.ts",
                "tailwind.config.ts",
                "vitest.config.ts",
                "vitest.setup.ts",
                ".prettierrc.mts",
                "**/*.d.ts",
            ],
        },
    },
});
