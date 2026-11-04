import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getProxmoxConfig } from "@/utils/config/proxmox";
import type { ProxmoxConfig } from "@/utils/config/types";
import createLogger from "@/utils/logger";
import { httpProxy } from "@/utils/proxy/http";

const logger = createLogger("proxmoxStatsService");
const VALID_VM_TYPES = new Set(["qemu", "lxc"]);
const VALID_NODE = /^[A-Za-z0-9._-]+$/;
const VALID_VMID = /^\d+$/;

async function handler(req: ApiRequest, res: ApiResponse) {
    const { service, type: vmType } = req.query;

    const [node, vmid] = service || [];

    if (!node) {
        logger.warn("Proxmox stats request without a node (service path %j)", service);
        return res.status(400).send({
            error: "Proxmox node parameter is required",
        });
    }

    if (typeof node !== "string" || !VALID_NODE.test(node) || node.includes("..")) {
        logger.warn('Proxmox stats request with an invalid node "%s"', node);
        return res.status(400).send({
            error: "Invalid Proxmox node parameter",
        });
    }

    if (typeof vmid !== "string" || !VALID_VMID.test(vmid)) {
        logger.warn('Proxmox stats request for node "%s" with an invalid VMID "%s"', node, vmid);
        return res.status(400).send({
            error: "Invalid Proxmox VMID parameter",
        });
    }

    if (typeof vmType !== "string" || !VALID_VM_TYPES.has(vmType)) {
        logger.warn('Proxmox stats request for VM %s on node "%s" with an invalid type "%s"', vmid, node, vmType);
        return res.status(400).send({
            error: "Invalid Proxmox type parameter",
        });
    }

    try {
        const proxmoxConfig = (await getProxmoxConfig()) as ProxmoxConfig | undefined;

        if (!proxmoxConfig) {
            return res.status(500).send({
                error: "Proxmox server configuration not found",
            });
        }

        // Prefer per-node config (new format), fall back to legacy flat creds.
        const nodeEntry = node ? proxmoxConfig[node] : undefined;
        const { url, token, secret } = proxmoxConfig;
        const nodeConfig =
            (nodeEntry && typeof nodeEntry === "object" ? nodeEntry : null) ||
            (typeof url === "string" &&
            url &&
            typeof token === "string" &&
            token &&
            typeof secret === "string" &&
            secret
                ? { url, token, secret }
                : null);

        if (!nodeConfig) {
            return res.status(400).json({
                error:
                    "Proxmox config not found for the specified node and no legacy credentials detected. " +
                    "Add a node block to the proxmox config (e.g., 'pve: { url, token, secret }') or restore legacy top-level url/token/secret.",
            });
        }

        const baseUrl = `${nodeConfig.url}/api2/json`;
        const headers = {
            Authorization: `PVEAPIToken=${nodeConfig.token}=${nodeConfig.secret}`,
        };

        const statusUrl = `${baseUrl}/nodes/${node}/${vmType}/${vmid}/status/current`;

        const [status, , data] = await httpProxy(statusUrl, {
            method: "GET",
            headers,
        });

        if (status !== 200) {
            logger.error("HTTP Error %d calling Proxmox API", status);
            return res.status(status).send({
                error: `Failed to fetch Proxmox ${vmType} status`,
            });
        }

        const parsedData = JSON.parse(Buffer.from(data as Buffer | string).toString());

        if (!parsedData || !parsedData.data) {
            return res.status(500).send({
                error: "Invalid response from Proxmox API",
            });
        }

        return res.status(200).json({
            status: parsedData.data.status || "unknown",
            cpu: parsedData.data.cpu,
            mem: parsedData.data.mem,
        });
    } catch (error) {
        logger.error("Error fetching Proxmox status:", error);
        return res.status(500).send({
            error: "Failed to fetch Proxmox status",
        });
    }
}

export default withAuth(handler);
