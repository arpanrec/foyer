import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, kube, apiExt } = vi.hoisted(() => {
    const apiExt = {
        readCustomResourceDefinitionStatus: vi.fn(),
    };

    const kube = {
        loadFromCluster: vi.fn(),
        loadFromDefault: vi.fn(),
        makeApiClient: vi.fn(() => apiExt),
    };

    return {
        store: {
            getConfig: vi.fn(),
        },
        kube,
        apiExt,
    };
});

vi.mock("@/utils/config/store", () => ({ getConfig: store.getConfig }));

vi.mock("@kubernetes/client-node", () => ({
    ApiextensionsV1Api: class ApiextensionsV1Api {},
    KubeConfig: class KubeConfig {
        clusters: { name: string; server: string; skipTLSVerify: boolean; tlsServerName?: string }[] = [];

        loadFromCluster() {
            this.clusters = [{ name: "inCluster", server: "https://host:443", skipTLSVerify: false }];
            return kube.loadFromCluster();
        }
        loadFromDefault() {
            return kube.loadFromDefault();
        }
        makeApiClient() {
            return kube.makeApiClient();
        }
    },
}));

import { checkCRD, getKubeConfig, getKubernetes } from "@/utils/config/kubernetes";

describe("utils/config/kubernetes", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
    });

    it("getKubernetes reads the kubernetes config", async () => {
        store.getConfig.mockReturnValueOnce({ mode: "disabled" });

        expect(await getKubernetes()).toEqual({ mode: "disabled" });
    });

    it("getKubeConfig returns null when disabled", async () => {
        store.getConfig.mockReturnValueOnce({ mode: "disabled" });
        expect(await getKubeConfig()).toBeNull();
    });

    it("getKubeConfig loads from cluster/default based on mode", async () => {
        store.getConfig.mockReturnValueOnce({ mode: "cluster" });
        const kc1 = await getKubeConfig();
        expect(kube.loadFromCluster).toHaveBeenCalled();
        expect(kc1).not.toBeNull();

        store.getConfig.mockReturnValueOnce({ mode: "default" });
        const kc2 = await getKubeConfig();
        expect(kube.loadFromDefault).toHaveBeenCalled();
        expect(kc2).not.toBeNull();
    });

    it("getKubeConfig sets tlsServerName when the in-cluster host is IPv6", async () => {
        vi.stubEnv("KUBERNETES_SERVICE_HOST", "fd00:1018:2000::1");
        store.getConfig.mockReturnValueOnce({ mode: "cluster" });

        expect((await getKubeConfig())?.clusters[0]).toMatchObject({
            name: "inCluster",
            tlsServerName: "kubernetes.default.svc",
        });

        vi.unstubAllEnvs();
    });

    it("getKubeConfig leaves tlsServerName unset for non-IPv6 in-cluster hosts", async () => {
        vi.stubEnv("KUBERNETES_SERVICE_HOST", "10.43.0.1");
        store.getConfig.mockReturnValueOnce({ mode: "cluster" });

        expect((await getKubeConfig())?.clusters[0]!.tlsServerName).toBeUndefined();

        vi.unstubAllEnvs();
    });

    it("checkCRD returns true when the CRD exists", async () => {
        apiExt.readCustomResourceDefinitionStatus.mockResolvedValueOnce({ ok: true });
        const logger = { error: vi.fn() };

        await expect(checkCRD("x.example", kube as never, logger as never)).resolves.toBe(true);
    });

    it("checkCRD returns false and logs on 403", async () => {
        apiExt.readCustomResourceDefinitionStatus.mockRejectedValueOnce({
            statusCode: 403,
            body: { message: "nope" },
        });
        const logger = { error: vi.fn() };

        await expect(checkCRD("x.example", kube as never, logger as never)).resolves.toBe(false);
        expect(logger.error).toHaveBeenCalled();
    });
});
