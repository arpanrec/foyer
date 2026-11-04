import Docker from "dockerode";

import type { SwarmTask } from "@/types/docker";
import getDockerArguments from "@/utils/config/docker";
import { containersFromConfig, hasFoyerLabels } from "@/utils/config/service-helpers";
import { getSettings } from "@/utils/config/settings";
import { errorMessage } from "@/utils/error";
import createLogger from "@/utils/logger";

const logger = createLogger("dockerStatus");

const HEALTH_STATES = ["healthy", "unhealthy", "starting"];

type StatusEntry = { status?: string | undefined; health?: string | undefined };

function statusEntry(state: string, health?: string): StatusEntry {
    return health ? { status: state, health } : { status: state };
}

// docker exposes health only as a filter on the list endpoint, never as a field
// A list that fails leaves those containers without a health state, so the status still shows
async function healthByContainerId(docker: Docker, server: string) {
    const results = await Promise.all(
        HEALTH_STATES.map((state) =>
            docker.listContainers({ all: true, filters: { health: [state] } }).catch((e: unknown) => {
                logger.warn("Could not list %s containers on Docker server '%s': %s", state, server, errorMessage(e));
                return [];
            })
        )
    );

    const health: Record<string, string> = {};
    HEALTH_STATES.forEach((state, index) => {
        const containers = results[index];
        if (!Array.isArray(containers)) return;
        containers.forEach((container) => {
            health[container.Id] = state;
        });
    });

    return health;
}

export async function getDockerStatuses(server: string) {
    const dockerArgs = await getDockerArguments(server);
    if (!dockerArgs) throw new TypeError(`Docker server "${server}" is not configured`);
    const docker = new Docker(dockerArgs.conn);

    const [containers, health, configured] = await Promise.all([
        docker.listContainers({ all: true }),
        healthByContainerId(docker, server),
        containersFromConfig(server),
    ]);

    if (!Array.isArray(containers)) {
        return { error: "query failed" };
    }

    const { instanceName } = await getSettings();
    const statuses: Record<string, StatusEntry> = {};
    const byId: Record<string, StatusEntry> = {};

    containers.forEach((container) => {
        const info = statusEntry(container.State, health[container.Id]);
        // keyed by id for every container so swarm tasks can resolve their local container
        byId[container.Id] = info;

        const labelled = hasFoyerLabels(container.Labels, instanceName);
        container.Names.forEach((name) => {
            const containerName = name.replace(/^\//, "");
            if (labelled || configured.has(containerName)) statuses[containerName] = info;
        });
    });

    if (!dockerArgs.swarm) {
        return { statuses };
    }

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

    const localIds = new Set<string | undefined>(containers.map((container) => container.Id));
    const tasksByService: Record<string, SwarmTask[]> = {};
    tasks.forEach((task) => {
        (tasksByService[task.ServiceID] ??= []).push(task);
    });

    services.forEach((service) => {
        const name = service.Spec?.Name;
        if (!name || statuses[name]) return;
        if (!configured.has(name) && !hasFoyerLabels(service.Spec?.Labels, instanceName)) return;

        const serviceTasks = tasksByService[service.ID] ?? [];

        if (service.Spec?.Mode?.Replicated) {
            const replicas = parseInt(String(service.Spec.Mode.Replicated.Replicas), 10);
            if (serviceTasks.length === replicas) {
                statuses[name] = { status: `running ${serviceTasks.length}/${replicas}` };
            } else if (serviceTasks.length > 0) {
                statuses[name] = { status: `partial ${serviceTasks.length}/${replicas}` };
            }
            return;
        }

        const task =
            serviceTasks.find((candidate) => localIds.has(candidate.Status?.ContainerStatus?.ContainerID)) ??
            serviceTasks.at(0);
        const containerId = task?.Status?.ContainerStatus?.ContainerID;
        if (containerId && byId[containerId]) {
            statuses[name] = byId[containerId];
        } else if (task) {
            statuses[name] = { status: task.Status?.State };
        }
    });

    return { statuses };
}
