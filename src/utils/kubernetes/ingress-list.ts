import { NetworkingV1Api, type V1Ingress } from "@kubernetes/client-node";

import { getKubeConfig, getKubernetes } from "@/utils/config/kubernetes";
import createLogger from "@/utils/logger";

const logger = createLogger("ingress-list");

export default async function listIngress() {
    const kc = await getKubeConfig();
    if (!kc) return [];

    const networking = kc.makeApiClient(NetworkingV1Api);
    const { ingress = true } = await getKubernetes();
    let ingressList: V1Ingress[] = [];

    if (ingress) {
        const ingressData = await networking
            .listIngressForAllNamespaces()
            .then((response) => response)
            .catch((error) => {
                logger.error("Error getting ingresses: %d %s %s", error.statusCode, error.body, error.response);
                logger.debug(error);
                return null;
            });
        ingressList = ingressData?.items ?? [];
    }
    return ingressList;
}
