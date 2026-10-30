import { CustomObjectsApi } from "@kubernetes/client-node";

import { substituteEnvironmentVars } from "@/utils/config/config";
import {
    ANNOTATION_BASE,
    ANNOTATION_WIDGET_BASE,
    getKubeConfig,
    HTTPROUTE_API_GROUP,
    HTTPROUTE_API_VERSION,
} from "@/utils/config/kubernetes";
import * as shvl from "@/utils/config/shvl";
import type { DiscoveredService } from "@/utils/config/types";
import type { KubernetesGateway, KubernetesParentRef, KubernetesResource } from "@/utils/kubernetes/types";
import createLogger from "@/utils/logger";

const logger = createLogger("resource-helpers");
const kc = getKubeConfig();

const getSchemaFromGateway = async (parentRef: KubernetesParentRef, routeNamespace: string) => {
    if (!kc) return "http";

    const crd = kc.makeApiClient(CustomObjectsApi);
    const schema = await crd
        .getNamespacedCustomObject({
            group: HTTPROUTE_API_GROUP,
            version: HTTPROUTE_API_VERSION,
            // parentRef namespace is optional, defaults to the route's namespace
            namespace: parentRef.namespace ?? routeNamespace,
            plural: "gateways",
            name: parentRef.name,
        })
        .then((response: KubernetesGateway) => {
            const listener =
                response.spec.listeners.find((l) => l.name === parentRef.sectionName) ?? response.spec.listeners[0];

            return listener.protocol.toLowerCase();
        })
        .catch((error) => {
            logger.error("Error getting gateways: %s", error.body ?? error.message);
            logger.debug(error);

            return "http";
        });

    return schema;
};

async function getUrlFromHttpRoute(resource: KubernetesResource) {
    let url = null;
    const hasHostName = resource.spec?.hostnames;

    if (hasHostName) {
        const spec = resource.spec!;
        const path = spec.rules![0].matches![0].path!;
        if (path.type !== "RegularExpression") {
            const urlHost = spec.hostnames![0];
            const urlPath = path.value;
            const urlSchema = await getSchemaFromGateway(spec.parentRefs![0], resource.metadata!.namespace!);
            url = `${urlSchema}://${urlHost}${urlPath}`;
        }
    }

    return url;
}

function getUrlFromIngress(resource: KubernetesResource) {
    const spec = resource.spec!;
    const urlHost = spec.rules![0].host;
    const urlPath = spec.rules![0].http!.paths[0].path;
    const urlSchema = spec.tls ? "https" : "http";

    return `${urlSchema}://${urlHost}${urlPath}`;
}

async function getUrlSchema(resource: KubernetesResource) {
    const isHttpRoute = resource.kind === "HTTPRoute";
    let urlSchema;
    if (isHttpRoute) {
        urlSchema = getUrlFromHttpRoute(resource);
    } else {
        urlSchema = getUrlFromIngress(resource);
    }

    return urlSchema;
}

export function isDiscoverable(resource: KubernetesResource, instanceName: unknown) {
    const annotations = resource.metadata?.annotations;
    return (
        annotations &&
        annotations[`${ANNOTATION_BASE}/enabled`] === "true" &&
        (!annotations[`${ANNOTATION_BASE}/instance`] ||
            annotations[`${ANNOTATION_BASE}/instance`] === instanceName ||
            `${ANNOTATION_BASE}/instance.${instanceName}` in annotations)
    );
}

export async function constructedServiceFromResource(resource: KubernetesResource): Promise<DiscoveredService> {
    const annotations = resource.metadata!.annotations!;
    const metadata = resource.metadata!;
    let constructedService: Record<string, unknown> = {
        app: annotations[`${ANNOTATION_BASE}/app`] || metadata.name,
        namespace: metadata.namespace,
        href: annotations[`${ANNOTATION_BASE}/href`] || (await getUrlSchema(resource)),
        name: annotations[`${ANNOTATION_BASE}/name`] || metadata.name,
        group: annotations[`${ANNOTATION_BASE}/group`] || "Kubernetes",
        weight: annotations[`${ANNOTATION_BASE}/weight`] || "0",
        icon: annotations[`${ANNOTATION_BASE}/icon`] || "",
        description: annotations[`${ANNOTATION_BASE}/description`] || "",
        external: false,
        type: "service",
    };
    if (annotations[`${ANNOTATION_BASE}/external`]) {
        constructedService.external = String(annotations[`${ANNOTATION_BASE}/external`]).toLowerCase() === "true";
    }
    if (annotations[`${ANNOTATION_BASE}/pod-selector`] !== undefined) {
        constructedService.podSelector = annotations[`${ANNOTATION_BASE}/pod-selector`];
    }
    if (annotations[`${ANNOTATION_BASE}/ping`]) {
        constructedService.ping = annotations[`${ANNOTATION_BASE}/ping`];
    }
    if (annotations[`${ANNOTATION_BASE}/siteMonitor`]) {
        constructedService.siteMonitor = annotations[`${ANNOTATION_BASE}/siteMonitor`];
    }
    if (annotations[`${ANNOTATION_BASE}/statusStyle`]) {
        constructedService.statusStyle = annotations[`${ANNOTATION_BASE}/statusStyle`];
    }

    Object.keys(annotations).forEach((annotation) => {
        if (annotation.startsWith(ANNOTATION_WIDGET_BASE)) {
            shvl.set(constructedService, annotation.replace(`${ANNOTATION_BASE}/`, ""), annotations[annotation]);
        }
    });

    try {
        constructedService = JSON.parse(substituteEnvironmentVars(JSON.stringify(constructedService)));
    } catch (e) {
        logger.error("Error attempting k8s environment variable substitution.");
        logger.debug(e);
    }

    return constructedService as DiscoveredService;
}
