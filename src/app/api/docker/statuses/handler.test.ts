import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { state, DockerCtor, getDockerArguments, containersFromConfig, hasFoyerLabels, getSettings, logger } = vi.hoisted(
    () => {
        type DockerMock = {
            listContainers: ReturnType<typeof vi.fn>;
            listServices: ReturnType<typeof vi.fn>;
            listTasks: ReturnType<typeof vi.fn>;
        };
        const state: {
            docker: DockerMock | null;
            containers: unknown[] | Buffer;
            health: Record<string, unknown[]>;
            dockerArgs: { conn?: { socketPath?: string; host?: string }; swarm?: boolean } | null;
        } = {
            docker: null,
            containers: [],
            health: {},
            dockerArgs: { conn: { socketPath: "/var/run/docker.sock" }, swarm: false },
        };

        function DockerCtor() {
            return state.docker;
        }

        return {
            state,
            DockerCtor,
            getDockerArguments: vi.fn(() => state.dockerArgs),
            containersFromConfig: vi.fn(async () => new Set()),
            hasFoyerLabels: vi.fn((_labels?: Record<string, string>) => false),
            getSettings: vi.fn(() => ({ instanceName: undefined as string | undefined })),
            logger: { error: vi.fn() },
        };
    }
);

vi.mock("dockerode", () => ({
    default: DockerCtor,
}));

vi.mock("@/utils/config/docker", () => ({
    default: getDockerArguments,
}));

vi.mock("@/utils/config/service-helpers", () => ({
    containersFromConfig,
    hasFoyerLabels,
}));

vi.mock("@/utils/config/config", () => ({
    getSettings,
}));

vi.mock("@/utils/logger", () => ({
    default: () => logger,
}));

import handler from "@/app/api/docker/statuses/handler";

describe("app/api/docker/statuses/handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.dockerArgs = { conn: { socketPath: "/var/run/docker.sock" }, swarm: false };
        state.containers = [];
        state.health = {};
        state.docker = {
            listContainers: vi.fn(async (options) => {
                const health = options?.filters?.health?.[0];
                return health ? (state.health[health] ?? []) : state.containers;
            }),
            listServices: vi.fn(),
            listTasks: vi.fn(),
        };
        containersFromConfig.mockResolvedValue(new Set());
        hasFoyerLabels.mockReturnValue(false);
        getSettings.mockReturnValue({ instanceName: undefined });
    });

    it("returns configured container statuses with health from the docker health filters", async () => {
        containersFromConfig.mockResolvedValue(new Set(["glance", "share"]));
        state.containers = [
            { Names: ["/glance"], Id: "cid-glance", State: "running" },
            { Names: ["/share"], Id: "cid-share", State: "exited" },
        ];
        state.health = { healthy: [{ Id: "cid-glance" }] };

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(getDockerArguments).toHaveBeenCalledWith("local");
        expect(containersFromConfig).toHaveBeenCalledWith("local");
        // one list plus one per health state, constant regardless of container count
        expect(state.docker?.listContainers).toHaveBeenCalledTimes(4);
        expect(state.docker?.listServices).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            statuses: {
                glance: { status: "running", health: "healthy" },
                share: { status: "exited" },
            },
        });
    });

    it("takes health from the filter results rather than the status string", async () => {
        containersFromConfig.mockResolvedValue(new Set(["app"]));
        state.containers = [{ Names: ["/app"], Id: "cid1", State: "running", Status: "Up 2 hours (healthy)" }];
        state.health = { unhealthy: [{ Id: "cid1" }] };

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: { app: { status: "running", health: "unhealthy" } } });
    });

    it("omits health when the docker daemon rejects the health filter", async () => {
        containersFromConfig.mockResolvedValue(new Set(["app"]));
        state.containers = [{ Names: ["/app"], Id: "cid1", State: "running", Status: "Up 2 hours (healthy)" }];
        state.docker?.listContainers.mockImplementation(async (options?: { filters?: { health?: string[] } }) => {
            if (options?.filters?.health) throw new Error("filter unsupported");
            return state.containers;
        });

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: { app: { status: "running" } } });
    });

    it("omits containers that are neither configured nor labelled for foyer", async () => {
        containersFromConfig.mockResolvedValue(new Set(["glance"]));
        state.containers = [
            { Names: ["/glance"], State: "running", Status: "Up" },
            { Names: ["/secret-db"], State: "running", Status: "Up" },
        ];

        const req = { query: { server: "local" } };
        const res = createMockRes<{ statuses: Record<string, unknown> }>();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: { glance: { status: "running" } } });
        expect(res.body.statuses["secret-db"]).toBeUndefined();
    });

    it("includes containers discovered through foyer labels", async () => {
        hasFoyerLabels.mockImplementation((labels) => labels?.["foyer.name"] !== undefined);
        state.containers = [
            { Names: ["/labelled"], State: "running", Status: "Up", Labels: { "foyer.name": "App" } },
            { Names: ["/unlabelled"], State: "running", Status: "Up", Labels: {} },
        ];

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: { labelled: { status: "running" } } });
    });

    it("includes swarm services when the server is in swarm mode", async () => {
        if (state.dockerArgs) state.dockerArgs.swarm = true;
        containersFromConfig.mockResolvedValue(new Set(["web", "api"]));
        state.containers = [{ Names: ["/web"], Id: "cid1", State: "running", Status: "Up" }];
        state.docker?.listServices.mockResolvedValue([
            { ID: "sid", Spec: { Name: "api", Mode: { Replicated: { Replicas: "2" } } } },
        ]);
        state.docker?.listTasks.mockResolvedValue([
            { ServiceID: "sid", Status: {} },
            { ServiceID: "sid", Status: {} },
        ]);

        const req = { query: { server: "swarm" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            statuses: {
                web: { status: "running" },
                api: { status: "running 2/2" },
            },
        });
    });

    it("omits swarm services that are neither configured nor labelled", async () => {
        if (state.dockerArgs) state.dockerArgs.swarm = true;
        containersFromConfig.mockResolvedValue(new Set());
        state.containers = [];
        state.docker?.listServices.mockResolvedValue([
            { ID: "sid", Spec: { Name: "internal", Mode: { Replicated: { Replicas: "1" } } } },
        ]);
        state.docker?.listTasks.mockResolvedValue([{ ServiceID: "sid", Status: {} }]);

        const req = { query: { server: "swarm" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: {} });
    });

    it("includes swarm services discovered through foyer labels", async () => {
        if (state.dockerArgs) state.dockerArgs.swarm = true;
        hasFoyerLabels.mockImplementation((labels) => labels?.["foyer.name"] !== undefined);
        state.containers = [];
        state.docker?.listServices.mockResolvedValue([
            {
                ID: "sid",
                Spec: { Name: "api", Labels: { "foyer.name": "Api" }, Mode: { Replicated: { Replicas: "1" } } },
            },
        ]);
        state.docker?.listTasks.mockResolvedValue([{ ServiceID: "sid", Status: {} }]);

        const req = { query: { server: "swarm" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.body).toEqual({ statuses: { api: { status: "running 1/1" } } });
    });

    it("returns only listed containers when swarm queries fail", async () => {
        if (state.dockerArgs) state.dockerArgs.swarm = true;
        containersFromConfig.mockResolvedValue(new Set(["web"]));
        state.containers = [{ Names: ["/web"], Id: "cid1", State: "running", Status: "Up" }];
        state.docker?.listServices.mockRejectedValue(new Error("no services"));
        state.docker?.listTasks.mockRejectedValue(new Error("no tasks"));

        const req = { query: { server: "swarm" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ statuses: { web: { status: "running" } } });
    });

    it("returns 500 when docker returns a non-array containers payload", async () => {
        state.containers = Buffer.from("bad");

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "query failed" });
    });

    it("logs and returns 500 when the docker query throws", async () => {
        getDockerArguments.mockImplementationOnce(() => {
            throw new Error("boom");
        });

        const req = { query: { server: "local" } };
        const res = createMockRes();

        await handler(req, res as ApiResponse);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: { message: "boom" } });
        expect(logger.error).toHaveBeenCalled();
    });
});
