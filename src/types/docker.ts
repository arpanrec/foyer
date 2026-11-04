import type Docker from "dockerode";

// @types/dockerode leaves the task status out
export type SwarmTask = Docker.Task & {
    Status?: {
        State?: string;
        ContainerStatus?: { ContainerID?: string };
    };
};
