import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

// Starts the compose stack in this folder before the tests and stops it after them (see global-setup.ts). The regular
// `pnpm test` leaves these tests out:
//   pnpm exec vitest run --config test/mjpeg/vitest.config.ts
export default defineConfig({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("../../src", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        globalSetup: ["test/mjpeg/global-setup.ts"],
        include: ["test/mjpeg/**/*.test.ts"],
        testTimeout: 20_000,
    },
});
