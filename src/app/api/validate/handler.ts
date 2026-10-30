import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import checkAndCopyConfig from "@/utils/config/config";
import createLogger from "@/utils/logger";

const configs = ["docker.yaml", "settings.yaml", "services.yaml", "bookmarks.yaml", "kubernetes.yaml", "proxmox.yaml"];
const logger = createLogger("configValidationHandler");

// A YAML parse error from checkAndCopyConfig, tagged with the file it came from
type ConfigError = { name?: string; config?: string; reason?: string; mark?: { line?: number } };

async function handler(req: ApiRequest, res: ApiResponse) {
    const errors = configs.map((config) => checkAndCopyConfig(config)).filter((status) => status !== true);
    if (errors.length === 0) {
        return res.send(errors);
    }

    logger.error("Configuration validation errors", errors);
    return res.send(
        errors.map((status) => {
            // a config directory that cannot be created reports `false` with no detail
            const error: ConfigError = typeof status === "object" ? status : {};
            return {
                name: error.name,
                config: error.config,
                reason: error.reason,
                mark: { line: error.mark?.line },
            };
        })
    );
}

export default withAuth(handler);
