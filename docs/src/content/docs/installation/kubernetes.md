---
title: Kubernetes Installation
description: Install on Kubernetes
---

## Install with Kubernetes Manifests

Foyer does not ship an official Helm chart. Instead, write your own manifests and apply them with
`kubectl apply -f filename.yaml`.

Here's a working example of the resources you need:

#### ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
secrets:
    - name: foyer
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
type: kubernetes.io/service-account-token
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
    annotations:
        kubernetes.io/service-account.name: foyer
```

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
data:
    foyer.config.jsonc.njk: |
        {
            "kubernetes": { "mode": "cluster" },
            "settings": {
                // "providers": {
                //     "longhorn": { "url": "https://longhorn.my.network" },
                // },
            },
            "bookmarks": [{ "Developer": [{ "Github": [{ "abbr": "GH", "href": "https://github.com/" }] }] }],
            "services": [
                { "My First Group": [{ "My First Service": { "href": "http://localhost/", "description": "Foyer is awesome" } }] },
                { "My Second Group": [{ "My Second Service": { "href": "http://localhost/", "description": "Foyer is the best" } }] },
            ],
            "widgets": [
                {
                    "kubernetes": {
                        "cluster": { "show": true, "cpu": true, "memory": true, "showLabel": true, "label": "cluster" },
                        "nodes": { "show": true, "cpu": true, "memory": true, "showLabel": true },
                    },
                },
                {
                    "resources": { "backend": "resources", "expanded": true, "cpu": true, "memory": true, "network": "default" },
                },
                { "search": { "provider": "duckduckgo", "target": "_blank" } },
            ],
        }
```

#### ClusterRole and ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
    name: foyer
    labels:
        app.kubernetes.io/name: foyer
rules:
    - apiGroups:
          - ""
      resources:
          - namespaces
          - pods
          - nodes
      verbs:
          - get
          - list
    - apiGroups:
          - extensions
          - networking.k8s.io
      resources:
          - ingresses
      verbs:
          - get
          - list
    - apiGroups:
          - traefik.io
          - traefik.containo.us
      resources:
          - ingressroutes
      verbs:
          - get
          - list
    - apiGroups:
          - apiextensions.k8s.io
      resources:
          - customresourcedefinitions
      verbs:
          - get
    - apiGroups:
          - gateway.networking.k8s.io
      resources:
          - httproutes
          - gateways
      verbs:
          - get
          - list
    - apiGroups:
          - metrics.k8s.io
      resources:
          - nodes
          - pods
      verbs:
          - get
          - list
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
    name: foyer
    labels:
        app.kubernetes.io/name: foyer
roleRef:
    apiGroup: rbac.authorization.k8s.io
    kind: ClusterRole
    name: foyer
subjects:
    - kind: ServiceAccount
      name: foyer
      namespace: default
```

The `traefik.io`, `traefik.containo.us`, `apiextensions.k8s.io` and `gateway.networking.k8s.io` rules are only
needed when `traefik: true` or `gateway: true` are set in the `kubernetes` config member. Foyer checks for the `traefik.io` and `traefik.containo.us` Traefik CRD API
groups (`traefik.containo.us` is the group used before Traefik v3) and needs permission to read
`CustomResourceDefinitions` to tell which one is installed. The `metrics.k8s.io` rule is only needed when a Metrics
Service is installed and the [Kubernetes info widget](/widgets/info/kubernetes/) or per-service CPU/memory
stats are used. See [Kubernetes Configuration](/configs/kubernetes/) for the available modes and discovery
options.

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
spec:
    type: ClusterIP
    ports:
        - port: 3000
          targetPort: http
          protocol: TCP
          name: http
    selector:
        app.kubernetes.io/name: foyer
```

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
spec:
    revisionHistoryLimit: 3
    replicas: 1
    strategy:
        type: RollingUpdate
    selector:
        matchLabels:
            app.kubernetes.io/name: foyer
    template:
        metadata:
            labels:
                app.kubernetes.io/name: foyer
        spec:
            serviceAccountName: foyer
            automountServiceAccountToken: true
            dnsPolicy: ClusterFirst
            enableServiceLinks: true
            containers:
                - name: foyer
                  image: "docker.io/arpanrecme/foyer:latest"
                  imagePullPolicy: Always
                  securityContext:
                      allowPrivilegeEscalation: false
                      capabilities:
                          drop:
                              - ALL
                      runAsNonRoot: true
                      runAsUser: 1000
                      runAsGroup: 1000
                      seccompProfile:
                          type: RuntimeDefault
                  env:
                      - name: MY_POD_IP
                        valueFrom:
                            fieldRef:
                                fieldPath: status.podIP
                      - name: FOYER_ALLOWED_HOSTS
                        value: "$(MY_POD_IP):3000,foyer.arpanrec.com" # See foyer.arpanrec.com/installation/#foyer_allowed_hosts . Value before the comma is required for the k8s probe
                  ports:
                      - name: http
                        containerPort: 3000
                        protocol: TCP
                  livenessProbe:
                      httpGet:
                          path: /api/healthcheck
                          port: http
                      initialDelaySeconds: 5
                      periodSeconds: 15
                  volumeMounts:
                      - mountPath: /app/config/foyer.config.jsonc.njk
                        name: foyer-config
                        subPath: foyer.config.jsonc.njk
            volumes:
                - name: foyer-config
                  configMap:
                      name: foyer
```

#### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
    name: foyer
    namespace: default
    labels:
        app.kubernetes.io/name: foyer
    annotations:
        foyer.arpanrec.com/description: Dynamically Detected Foyer
        foyer.arpanrec.com/enabled: "true"
        foyer.arpanrec.com/group: Cluster Management
        foyer.arpanrec.com/icon: /apple-touch-icon.png
        foyer.arpanrec.com/name: Foyer
spec:
    rules:
        - host: "foyer.my.network"
          http:
              paths:
                  - path: "/"
                    pathType: Prefix
                    backend:
                        service:
                            name: foyer
                            port:
                                number: 3000
```

### Multiple Replicas

If you plan to deploy Foyer with a replica count greater than 1, you may want to consider enabling sticky sessions on
the Foyer route. This will prevent unnecessary re-renders on page loads and window / tab focusing. The procedure for
enabling sticky sessions depends on your Ingress controller. Below is an example using Traefik as the Ingress
controller.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
    name: foyer.example.com
spec:
    entryPoints:
        - websecure
    routes:
        - kind: Rule
          match: Host(`foyer.example.com`)
          services:
              - kind: Service
                name: foyer
                port: 3000
                sticky:
                    cookie:
                        httpOnly: true
                        secure: true
                        sameSite: none
```
