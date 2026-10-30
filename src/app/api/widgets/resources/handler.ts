import si, { type Systeminformation } from "systeminformation";

import { firstQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import createLogger from "@/utils/logger";

const logger = createLogger("resources");

function isMissingNetworkStat(networkData: Systeminformation.NetworkStatsData, _interfaceName: string) {
    return (
        networkData.operstate === "unknown" &&
        networkData.rx_bytes === 0 &&
        networkData.rx_dropped === 0 &&
        networkData.rx_errors === 0 &&
        networkData.tx_bytes === 0 &&
        networkData.tx_dropped === 0 &&
        networkData.tx_errors === 0 &&
        networkData.rx_sec === null &&
        networkData.tx_sec === null &&
        networkData.ms === 0
    );
}

async function handler(req: ApiRequest, res: ApiResponse) {
    const { type, target } = req.query;
    const interfaceName = firstQueryValue(req.query.interfaceName) ?? "default";

    if (type === "cpu") {
        const load = await si.currentLoad();
        return res.status(200).json({
            cpu: {
                usage: load.currentLoad,
                load: load.avgLoad,
            },
        });
    }

    if (type === "disk") {
        const requested = typeof target === "string" && target ? target : "/";
        const fsSize = await si.fsSize();
        logger.debug("fsSize:", JSON.stringify(fsSize));

        const drive = fsSize.find((fs) => {
            return fs.mount === requested;
        });

        if (!drive) {
            logger.warn(`Drive not found for target: ${requested}`);
            return res.status(404).json({ error: "Resource not available." });
        }

        return res.status(200).json({ drive });
    }

    if (type === "memory") {
        const memory = await si.mem();
        logger.debug("memory:", JSON.stringify(memory));
        return res.status(200).json({
            memory,
        });
    }

    if (type === "cputemp") {
        const cputemp = await si.cpuTemperature();
        logger.debug("cputemp:", JSON.stringify(cputemp));
        return res.status(200).json({
            cputemp,
        });
    }

    if (type === "uptime") {
        const timeData = await si.time();
        logger.debug("timeData:", JSON.stringify(timeData));
        return res.status(200).json({
            uptime: timeData.uptime,
        });
    }

    if (type === "network") {
        const allNetworkData = await si.networkStats("*");
        let networkData: Systeminformation.NetworkStatsData | null | undefined;
        let interfaceDefault: string | undefined;
        logger.debug("networkData:", JSON.stringify(allNetworkData));
        if (interfaceName && interfaceName !== "default") {
            networkData = allNetworkData.filter((network) => network.iface === interfaceName).at(0);
            if (!networkData) {
                // Fallback for e.g. docker where networkStats("*") may not return stats for host interfaces
                const directNetworkData = await si.networkStats(interfaceName);
                logger.debug("directNetworkData:", JSON.stringify(directNetworkData));
                networkData = Array.isArray(directNetworkData) ? directNetworkData.at(0) : null;

                // si returns unknown + zeroes when interface truly does not exist
                if (!networkData || isMissingNetworkStat(networkData, interfaceName)) {
                    networkData = null;
                }
            }
            if (!networkData) {
                return res.status(404).json({
                    error: "Interface not found",
                });
            }
        } else {
            interfaceDefault = await si.networkInterfaceDefault();
            networkData = allNetworkData.filter((network) => network.iface === interfaceDefault).at(0);
            if (!networkData) {
                return res.status(404).json({
                    error: "Default interface not found",
                });
            }
        }
        return res.status(200).json({
            network: networkData,
            interface: interfaceName !== "default" ? interfaceName : interfaceDefault,
        });
    }

    return res.status(400).json({
        error: "invalid type",
    });
}

export default withAuth(handler);
