import { CoreV1Api, Metrics } from "@kubernetes/client-node";

import type { KubernetesNodeCapacity } from "@/components/widgets/kubernetes/types";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getKubeConfig } from "@/utils/config/kubernetes";
import { errorMessage } from "@/utils/error";
import { parseCpu, parseMemory } from "@/utils/kubernetes/utils";
import createLogger from "@/utils/logger";

const logger = createLogger("widget");

async function handler(_req: ApiRequest, res: ApiResponse) {
    try {
        const kc = await getKubeConfig();
        if (!kc) {
            return res.status(500).send({
                error: "No kubernetes configuration",
            });
        }
        const coreApi = kc.makeApiClient(CoreV1Api);
        const metricsApi = new Metrics(kc);

        const nodes = await coreApi.listNode().catch((error) => {
            logger.error("Error getting nodes: %d %s %s", error.statusCode, error.body, error.response);
            logger.debug(error);
            return null;
        });
        if (!nodes) {
            return res.status(500).send({
                error: "An error occurred while fetching nodes, check logs for more details.",
            });
        }
        let cpuTotal = 0;
        let cpuUsage = 0;
        let memTotal = 0;
        let memUsage = 0;

        const nodeMap: Record<string, KubernetesNodeCapacity> = {};
        nodes.items.forEach((node) => {
            const nodeName = node.metadata?.name;
            const capacity = node.status?.capacity;
            // a node without a name or capacity has nothing to report
            const cpuCapacity = capacity?.["cpu"];
            const memoryCapacity = capacity?.["memory"];
            if (!nodeName || !cpuCapacity || !memoryCapacity) {
                logger.warn("Skipping Kubernetes node '%s', which reports no CPU or memory capacity", nodeName);
                return;
            }

            const cpu = Number.parseInt(cpuCapacity, 10);
            const mem = parseMemory(memoryCapacity);
            const ready =
                (node.status?.conditions ?? []).filter(
                    (condition) => condition.type === "Ready" && condition.status === "True"
                ).length > 0;
            nodeMap[nodeName] = {
                name: nodeName,
                ready,
                cpu: {
                    total: cpu,
                },
                memory: {
                    total: mem,
                },
            };
            cpuTotal += cpu;
            memTotal += mem;
        });

        try {
            const nodeMetrics = await metricsApi.getNodeMetrics();
            nodeMetrics.items.forEach((nodeMetric) => {
                // A node can join between the node list and the metrics call, and a node without CPU or memory
                // capacity is left out of the list. Skip its metrics, before the totals, so usage and capacity match.
                const node = nodeMap[nodeMetric.metadata.name];
                if (!node) {
                    logger.warn(
                        "Skipping metrics for node '%s', which the node list did not report",
                        nodeMetric.metadata.name
                    );
                    return;
                }
                const cpu = parseCpu(nodeMetric.usage.cpu);
                const mem = parseMemory(nodeMetric.usage.memory);
                cpuUsage += cpu;
                memUsage += mem;
                node.cpu.load = cpu;
                node.cpu.percent = (cpu / node.cpu.total) * 100;
                node.memory.used = mem;
                node.memory.free = node.memory.total - mem;
                node.memory.percent = (mem / node.memory.total) * 100;
            });
        } catch (error) {
            logger.error("Error getting metrics, ensure you have metrics-server installed:", JSON.stringify(error));
            return res.status(500).send({
                error: "Error getting metrics, check logs for more details",
            });
        }

        const cluster = {
            cpu: {
                load: cpuUsage,
                total: cpuTotal,
                percent: (cpuUsage / cpuTotal) * 100,
            },
            memory: {
                used: memUsage,
                total: memTotal,
                free: memTotal - memUsage,
                percent: (memUsage / memTotal) * 100,
            },
        };

        return res.status(200).json({
            cluster,
            nodes: Object.values(nodeMap),
        });
    } catch (e) {
        logger.error("Error getting Kubernetes cluster stats: %s", errorMessage(e) ?? String(e));
        return res.status(500).send({
            error: "unknown error",
        });
    }
}

export default withAuth(handler);
