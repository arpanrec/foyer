---
title: Kubernetes
description: Kubernetes Configuration
---

The Kubernetes connectivity has the following requirements:

- Kubernetes 1.19+
- Metrics Service
- An Ingress controller
    - Optionally: Gateway-API

The Kubernetes connection is configured in the `kubernetes.yaml` file. There are 3 modes to choose from:

- **disabled** - disables kubernetes connectivity
- **default** - uses the default kubeconfig [resolution](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)
- **cluster** - uses a service account inside the cluster

```yaml
mode: default
```

To configure Kubernetes gateway-api, ingress or ingressRoute service discovery, add one or multiple of the following settings.

Example settings:

```yaml
ingress: true # default, enable ingress only
```

or

```yaml
ingress: true # default, enable ingress
traefik: true # enable traefik ingressRoute
gateway: true # enable gateway-api
```

## Services

Once the Kubernetes connection is configured, individual services can be configured to pull statistics. Only CPU and Memory are currently supported.

Inside of the service you'd like to connect to a pod:

```yaml
- Emby:
  icon: emby.png
  href: "http://emby.home/"
  description: Media server
  namespace: media # The kubernetes namespace the app resides in
  app: emby # The name of the deployed app
```

The `app` field is used to create a label selector, in this example case it would match pods with the label: `app.kubernetes.io/name=emby`.

Sometimes this is insufficient for complex or atypical application deployments. In these cases, the `podSelector` field can be used. Any field selector can be used with it, so it allows for some very powerful selection capabilities.

For instance, it can be utilized to roll multiple underlying deployments under one application to see a high-level aggregate:

```yaml
- Element Chat:
      icon: matrix-light.png
      href: https://chat.example.com
      description: Matrix Synapse Powered Chat
      app: matrix-element
      namespace: comms
      podSelector: >-
          app.kubernetes.io/instance in (
              matrix-element,
              matrix-media-repo,
              matrix-media-repo-postgresql,
              matrix-synapse
          )
```

!!! note

    A blank string as a podSelector does not deactivate it, but will actually select all pods in the namespace. This is a useful way to capture the resource usage of a complex application siloed to a single namespace, like Longhorn.

## Automatic Service Discovery

Foyer features automatic service discovery by Ingress annotations. All configuration options can be applied using typical annotation syntax, beginning with `foyer.arpanrec.com/`.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
    name: emby
    annotations:
        foyer.arpanrec.com/enabled: "true"
        foyer.arpanrec.com/description: Media Server
        foyer.arpanrec.com/group: Media
        foyer.arpanrec.com/icon: emby.png
        foyer.arpanrec.com/name: Emby
        foyer.arpanrec.com/widget.type: "emby"
        foyer.arpanrec.com/widget.url: "https://emby.example.com"
        foyer.arpanrec.com/widget.headers.X-Auth-Key: "your-secret-here"
        foyer.arpanrec.com/pod-selector: ""
        foyer.arpanrec.com/weight: 10 # optional
        foyer.arpanrec.com/instance: "public" # optional
spec:
    rules:
        - host: emby.example.com
          http:
              paths:
                  - backend:
                        service:
                            name: emby
                            port:
                                number: 8080
                    path: /
                    pathType: Prefix
```

The `ping`, `siteMonitor` and `statusStyle` annotations, written as `foyer.arpanrec.com/ping` and so on, set the matching service options from [Services](services.md). The `foyer.arpanrec.com/external` annotation set to `true` hides the Kubernetes status of the service.

When the Kubernetes cluster connection has been properly configured, this service will be automatically discovered and added to your Foyer. **You do not need to specify the `namespace` or `app` values, as they will be automatically inferred.**

If you are using multiple instances of foyer, an `instance` annotation can be specified to limit services to a specific instance. If no instance is provided, the service will be visible on all instances.

If you have a single service that needs to be shown on multiple specific instances of foyer (but not on all of them), the service can be annotated by multiple `instance.name` annotations, where `name` can be the names of your specific multiple foyer instances. For example, a service that is annotated with `foyer.arpanrec.com/instance.public: ""` and `foyer.arpanrec.com/instance.internal: ""` will be shown on `public` and `internal` foyer instances.

Use the `foyer.arpanrec.com/pod-selector` selector to specify the pod used for the health check. For example, a service that is annotated with `foyer.arpanrec.com/pod-selector: app.kubernetes.io/name=deployment` would link to a pod with the label `app.kubernetes.io/name: deployment`.

### Traefik IngressRoute support

If enabled (with `traefik: true` in kubernetes.yaml), foyer can also read ingresses defined using the Traefik IngressRoute custom resource definition. Due to the complex nature of Traefik routing rules, it is required for the `foyer.arpanrec.com/href` annotation to be set:

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
    name: emby
    annotations:
        foyer.arpanrec.com/href: "https://emby.example.com"
        foyer.arpanrec.com/enabled: "true"
        foyer.arpanrec.com/description: Media Server
        foyer.arpanrec.com/group: Media
        foyer.arpanrec.com/icon: emby.png
        foyer.arpanrec.com/app: emby-app # optional, may be needed if app.kubernetes.io/name != ingress metadata.name
        foyer.arpanrec.com/name: Emby
        foyer.arpanrec.com/widget.type: "emby"
        foyer.arpanrec.com/widget.url: "https://emby.example.com"
        foyer.arpanrec.com/pod-selector: ""
        foyer.arpanrec.com/weight: 10 # optional
        foyer.arpanrec.com/instance: "public" # optional
spec:
    entryPoints:
        - websecure
    routes:
        - kind: Rule
          match: Host(`emby.example.com`)
          services:
              - kind: Service
                name: emby
                namespace: emby
                port: 8080
                scheme: http
                strategy: RoundRobin
                weight: 10
```

If the `href` attribute is not present, Foyer will ignore the specific IngressRoute.

### Gateway API HttpRoute support

Foyer also features automatic service discovery for Gateway API. Service definitions are read by annotating the HttpRoute custom resource definition and are indentical to the Ingress example as defined in [Automatic Service Discovery](#automatic-service-discovery).

To enable Gateway API HttpRoute update `kubernetes.yaml` to include:

```
gateway: true # enable gateway-api
```

## Caveats

Similarly to Docker service discovery, there currently is no rigid ordering to discovered services and discovered services will be displayed above those specified in the `services.yaml`.

## Adding extra configuration files

Some Foyer features (for example, [Proxmox](../configs/proxmox.md)) require additional configuration files such as `proxmox.yaml`.
When running Foyer on Kubernetes, these files must be provided via a `ConfigMap` and mounted into the container at `/app/config`.

### ConfigMap example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
    name: foyer
data:
    proxmox.yaml: |
        pve:
          url: https://proxmox.host.or.ip:8006
          token: username@pam!Token ID
          secret: secret
```

Mount the file into `/app/config` by updating the `Deployment`:

```yaml
volumeMounts:
    - mountPath: /app/config/proxmox.yaml
      name: foyer-config
      subPath: proxmox.yaml
```
