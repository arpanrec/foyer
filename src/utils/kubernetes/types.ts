// The fields of a Kubernetes Ingress, Traefik IngressRoute or Gateway API HTTPRoute that discovery reads
export type KubernetesMetadata = {
    name?: string;
    namespace?: string;
    annotations?: Record<string, string>;
};

export type KubernetesParentRef = { name: string; namespace?: string; sectionName?: string };

export type KubernetesResource = {
    kind?: string;
    metadata?: KubernetesMetadata;
    spec?: {
        // HTTPRoute
        hostnames?: string[];
        parentRefs?: KubernetesParentRef[];
        // Ingress rules have a host and http paths, HTTPRoute rules have matches
        rules?: {
            host?: string;
            http?: { paths: { path?: string }[] };
            matches?: { path?: { type?: string; value?: string } }[];
        }[];
        tls?: unknown;
    };
};

// The part of a Gateway read to pick the HTTPRoute url scheme
export type KubernetesGateway = {
    spec: { listeners: { name?: string; protocol: string }[] };
};
