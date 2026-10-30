import { readFileSync } from "fs";
import { isIPv6 } from "net";
import path from "path";

import { ApiextensionsV1Api, KubeConfig } from "@kubernetes/client-node";
import type winston from "winston";

import checkAndCopyConfig, { CONF_DIR, substituteEnvironmentVars } from "@/utils/config/config";
import { isRecord, type KubernetesConfig } from "@/utils/config/types";
import { loadYaml } from "@/utils/config/yaml";

export function getKubernetes(): KubernetesConfig {
    checkAndCopyConfig("kubernetes.yaml");
    const configFile = path.join(CONF_DIR, "kubernetes.yaml");
    const rawConfigData = readFileSync(configFile, "utf8");
    const configData = substituteEnvironmentVars(rawConfigData);
    const config = loadYaml(configData);
    return isRecord(config) ? config : {};
}

export const getKubeConfig = () => {
    const kc = new KubeConfig();
    const config = getKubernetes();

    switch (config?.mode) {
        case "cluster":
            kc.loadFromCluster();
            // node < 26 can't match an IPv6 host against an IP SAN, so verify against the DNS SAN instead (nodejs/node#64032)
            if (isIPv6(process.env.KUBERNETES_SERVICE_HOST ?? "")) {
                kc.clusters = kc.clusters.map((cluster) => ({ ...cluster, tlsServerName: "kubernetes.default.svc" }));
            }
            break;
        case "default":
            kc.loadFromDefault();
            break;
        case "disabled":
        default:
            return null;
    }

    return kc;
};

type KubernetesApiError = { statusCode?: number; body: { message?: string } };

export async function checkCRD(
    name: string,
    kc: Pick<KubeConfig, "makeApiClient">,
    logger: Pick<winston.Logger, "error">
) {
    const apiExtensions = kc.makeApiClient(ApiextensionsV1Api);
    const exist = await apiExtensions
        .readCustomResourceDefinitionStatus({
            name,
        })
        .then(() => true)
        .catch(async (error: KubernetesApiError) => {
            if (error.statusCode === 403) {
                logger.error(
                    "Error checking if CRD %s exists. Make sure to add the following permission to your RBAC: %d %s %s",
                    name,
                    error.statusCode,
                    error.body.message
                );
            }
            return false;
        });

    return exist;
}

export const ANNOTATION_BASE = "foyer.arpanrec.com";
export const ANNOTATION_WIDGET_BASE = `${ANNOTATION_BASE}/widget.`;
export const HTTPROUTE_API_GROUP = "gateway.networking.k8s.io";
export const HTTPROUTE_API_VERSION = "v1";
