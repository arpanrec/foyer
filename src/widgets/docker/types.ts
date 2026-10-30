export type DockerOptions = {
    server?: string;
    container?: string;
};

export type DockerStatusResponse = {
    error?: unknown;
    statuses?: Record<string, { status: string }>;
};

export type DockerContainerStats = {
    error?: unknown;
    cpu?: number;
    mem?: number;
    rx?: number;
    tx?: number;
};

export type DockerStatsResponse = {
    error?: unknown;
    stats?: Record<string, DockerContainerStats | undefined>;
};
