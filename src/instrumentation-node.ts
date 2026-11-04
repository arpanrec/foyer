import { validateAuthEnv } from "@/utils/auth-config";
import { applyNextAuthEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";
import createLogger, { closeLogger } from "@/utils/logger";

// The start-up work that needs Node.js APIs. src/instrumentation.ts imports it only on the Node.js runtime, so the
// Edge Runtime build never sees process.exit.
export default async function startNode() {
    applyNextAuthEnv();

    try {
        // A typo in the auth environment stops the container at start-up instead of failing the first request that
        // reaches the auth handler
        validateAuthEnv();
    } catch (e) {
        createLogger("startup").error("Foyer cannot start: %s", errorMessage(e) ?? String(e));
        await closeLogger();
        process.exit(1);
    }
}
