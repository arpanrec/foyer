import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/handler";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAllowedHost } from "@/utils/auth";
import { isAuthEnabled } from "@/utils/env";
import createLogger from "@/utils/logger";
import { handleMcpRequest, mcpEnabled, mcpTokenAuthorized, mcpTokenConfigError } from "@/utils/mcp/foyer-mcp";

async function hasFoyerSession(req: ApiRequest, res: ApiResponse) {
    if (!isAuthEnabled()) return false;
    // the route adapter's req and res stand in for the Pages Router API objects NextAuth expects
    return Boolean(
        await getServerSession(req as unknown as NextApiRequest, res as unknown as NextApiResponse, authOptions)
    );
}

async function handler(req: ApiRequest, res: ApiResponse) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!mcpEnabled()) {
        return res.status(404).end("Not Found");
    }

    // Method check precedes auth so CORS preflights aren't answered with a 401.
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).end("Method Not Allowed");
    }

    const tokenError = mcpTokenConfigError();
    if (tokenError) {
        createLogger("mcp").error(tokenError);
        return res.status(500).json({ error: "MCP token is misconfigured. See logs for details." });
    }

    if (!mcpTokenAuthorized(req) && !(await hasFoyerSession(req, res))) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const response = handleMcpRequest(req.body);
    if (!response) {
        return res.status(202).end();
    }

    return res.status(200).json(response);
}

export default withAllowedHost(handler);
