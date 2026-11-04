import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getConfigErrors } from "@/utils/config/store";

// The dashboard shows only these errors when there are any. A broken widgets config leaves out just the information
// widgets, so its error stays in the server log.
const NON_BLOCKING_CONFIGS = new Set(["widgets"]);

// Errors from the last config load: the whole file, or members that failed
async function handler(_req: ApiRequest, res: ApiResponse) {
    return res.send(
        (await getConfigErrors())
            .filter(({ config }) => !NON_BLOCKING_CONFIGS.has(config))
            .map(({ name, config, reason }) => ({ name, config, reason }))
    );
}

export default withAuth(handler);
