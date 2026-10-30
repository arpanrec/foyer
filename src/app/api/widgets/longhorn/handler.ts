import type { LonghornApiNodes, LonghornNode } from "@/components/widgets/longhorn/types";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/config";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";

const logger = createLogger("longhorn");

function parseLonghornData(data: string | Buffer): LonghornNode[] | null {
    const json: LonghornApiNodes | null = JSON.parse(data.toString());

    if (!json) {
        return null;
    }

    const nodes = json.data.map((node): LonghornNode => {
        let available = 0;
        let maximum = 0;
        let reserved = 0;
        let scheduled = 0;
        if (node.disks) {
            Object.values(node.disks).forEach((disk) => {
                available += disk.storageAvailable;
                maximum += disk.storageMaximum;
                reserved += disk.storageReserved;
                scheduled += disk.storageScheduled;
            });
        }
        return {
            id: node.id,
            available,
            maximum,
            reserved,
            scheduled,
        };
    });
    const total = nodes.reduce(
        (summary, node) => ({
            id: summary.id,
            available: summary.available + node.available,
            maximum: summary.maximum + node.maximum,
            reserved: summary.reserved + node.reserved,
            scheduled: summary.scheduled + node.scheduled,
        }),
        { id: "total", available: 0, maximum: 0, reserved: 0, scheduled: 0 }
    );
    nodes.push(total);
    return nodes;
}

async function handler(req: ApiRequest, res: ApiResponse) {
    const settings = getSettings();
    const longhornSettings = (settings?.providers?.longhorn || {}) as {
        url?: string;
        username?: string;
        password?: string;
    };
    const { url, username, password } = longhornSettings;

    if (!url) {
        const errorMessage = "Missing Longhorn URL";
        logger.error(errorMessage);
        return res.status(400).json({ error: errorMessage });
    }

    const apiUrl = `${url}/v1/nodes`;
    const headers: Record<string, string> = {
        "Accept-Encoding": "application/json",
    };
    if (username && password) {
        headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
    const params = { method: "GET", headers };

    const [status, contentType, data] = await httpProxy(apiUrl, params);

    if (status === 401) {
        logger.error("Authorization failure getting data from Longhorn API. Data: %s", data);
    }

    if (status !== 200) {
        logger.error("HTTP %d getting data from Longhorn API. Data: %s", status, data);
    }

    if (contentType) res.setHeader("Content-Type", contentType);

    const nodes = parseLonghornData(data as Buffer | string);

    return res.status(200).json({
        nodes,
    });
}

export default withAuth(handler);
