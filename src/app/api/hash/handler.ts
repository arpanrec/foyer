import { createHash } from "crypto";

import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getConfigHash } from "@/utils/config/store";
import { getEnv } from "@/utils/env";

function hash(buffer: string) {
    const hashSum = createHash("sha256");
    hashSum.update(buffer);
    return hashSum.digest("hex");
}

async function handler(_req: ApiRequest, res: ApiResponse) {
    // set to date by docker entrypoint, will force revalidation between restarts/recreates
    const buildTime = getEnv("BUILDTIME") || "";

    // the hash of the loaded config values, custom CSS and JS included, changes when a reload loads a different config
    const combinedHash = hash((await getConfigHash()) + buildTime);

    res.send({
        hash: combinedHash,
    });
}

export default withAuth(handler);
