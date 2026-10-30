import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import checkAndCopyConfig, { CONF_DIR } from "@/utils/config/config";
import { getEnv } from "@/utils/env";

const configs = [
    "docker.yaml",
    "settings.yaml",
    "services.yaml",
    "bookmarks.yaml",
    "widgets.yaml",
    "custom.css",
    "custom.js",
];

function hash(buffer: string) {
    const hashSum = createHash("sha256");
    hashSum.update(buffer);
    return hashSum.digest("hex");
}

async function handler(req: ApiRequest, res: ApiResponse) {
    const hashes = configs.map((config) => {
        checkAndCopyConfig(config);
        const configYaml = join(/* turbopackIgnore: true */ CONF_DIR, config);
        return hash(readFileSync(/* turbopackIgnore: true */ configYaml, "utf8"));
    });

    // set to date by docker entrypoint, will force revalidation between restarts/recreates
    const buildTime = getEnv("BUILDTIME") || "";

    const combinedHash = hash(hashes.join("") + buildTime);

    res.send({
        hash: combinedHash,
    });
}

export default withAuth(handler);
