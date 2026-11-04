import Docker from "dockerode";

import type { SwarmTask } from "@/types/docker";
import getDockerArguments from "@/utils/config/docker";
import { containersFromConfig, hasFoyerLabels } from "@/utils/config/service-helpers";
import { getSettings } from "@/utils/config/settings";
import { calculateCPUPercent, calculateThroughput, calculateUsedMemory } from "@/utils/docker/stats-helpers";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("dockerStats");

// mem and network are omitted when docker does not report them, so the widget can skip those blocks
async function statsForContainer(docker: Docker, id: string) {
    try {
        const raw = await docker.getContainer(id).stats({ stream: false });
        const stats: { cpu: number; mem?: number; rx?: number; tx?: number } = { cpu: calculateCPUPercent(raw) };

        if (raw.memory_stats?.usage) {
            stats.mem = calculateUsedMemory(raw);
        }

        if (raw.networks) {
            const { rxBytes, txBytes } = calculateThroughput(raw);
            stats.rx = rxBytes;
            stats.tx = txBytes;
        }

        return stats;
    } catch (e) {
        // ensure one failed call does not look like an absent container
        logger.warn("Could not read Docker stats for container %s: %s", id, errorMessage(e));
        return { error: errorMessage(e) ?? "stats unavailable" };
    }
}

export async function getDockerStats(server: string) {
    const dockerArgs = await getDockerArguments(server);
    if (!dockerArgs) throw new TypeError(`Docker server "${server}" is not configured`);
    const docker = new Docker(dockerArgs.conn);

    const [containers, configured] = await Promise.all([
        docker.listContainers({ all: true }),
        containersFromConfig(server),
    ]);

    if (!Array.isArray(containers)) {
        return { error: "query failed" };
    }

    const { instanceName } = await getSettings();
    const targets: Record<string, string> = {};
    const localIds = new Set<string | undefined>();

    containers.forEach((container) => {
        localIds.add(container.Id);
        if (container.State !== "running") return;

        const labelled = hasFoyerLabels(container.Labels, instanceName);
        container.Names.forEach((name) => {
            const containerName = name.replace(/^\//, "");
            if (labelled || configured.has(containerName)) targets[containerName] = container.Id;
        });
    });

    if (dockerArgs.swarm) {
        const [services, tasks] = await Promise.all([
            docker.listServices().catch((e: unknown) => {
                logger.warn("Could not list swarm services on Docker server '%s': %s", server, errorMessage(e));
                return [];
            }),
            docker.listTasks({ filters: { "desired-state": ["running"] } }).catch((e: unknown) => {
                logger.warn("Could not list swarm tasks on Docker server '%s': %s", server, errorMessage(e));
                return [];
            }),
        ]);

        const tasksByService: Record<string, SwarmTask[]> = {};
        tasks.forEach((task) => {
            (tasksByService[task.ServiceID] ??= []).push(task);
        });

        services.forEach((service) => {
            const name = service.Spec?.Name;
            if (!name || targets[name]) return;
            if (!configured.has(name) && !hasFoyerLabels(service.Spec?.Labels, instanceName)) return;

            // stats are only available for containers running on this node
            const serviceTasks = tasksByService[service.ID] ?? [];
            const task = serviceTasks.find((candidate) => localIds.has(candidate.Status?.ContainerStatus?.ContainerID));
            const containerId = task?.Status?.ContainerStatus?.ContainerID;
            if (containerId) targets[name] = containerId;
        });
    }

    const results = await Promise.all(
        Object.entries(targets).map(
            async ([name, containerId]) => [name, await statsForContainer(docker, containerId)] as const
        )
    );

    return { stats: Object.fromEntries(results) };
}
