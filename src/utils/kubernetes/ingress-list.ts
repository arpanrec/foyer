import { NetworkingV1Api, type V1Ingress } from "@kubernetes/client-node";

import { getKubeConfig, getKubernetes } from "@/utils/config/kubernetes";
import createLogger from "@/utils/logger";

const logger = createLogger("ingress-list");
const kc = getKubeConfig();

export default async function listIngress() {
    if (!kc) return [];

    const networking = kc.makeApiClient(NetworkingV1Api);
    const { ingress = true } = getKubernetes();
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
