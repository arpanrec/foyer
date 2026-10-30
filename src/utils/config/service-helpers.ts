import { promises as fs } from "fs";
import path from "path";

import Docker from "dockerode";

import type { ApiQueryValue } from "@/types/api";
import type { Service, ServiceGroup, WidgetConfig } from "@/types/service";
import checkAndCopyConfig, { CONF_DIR, getSettings, substituteEnvironmentVars } from "@/utils/config/config";
import getDockerArguments from "@/utils/config/docker";
import { getKubeConfig } from "@/utils/config/kubernetes";
import * as shvl from "@/utils/config/shvl";
import {
    type CleanedService,
    type CleanedServiceGroup,
    type DiscoveredService,
    type DockerServersConfig,
    type NestedServiceGroup,
    type RawWidgetConfig,
    type ServicesYaml,
} from "@/utils/config/types";
import { loadYaml } from "@/utils/config/yaml";
import kubernetes from "@/utils/kubernetes/export";
import createLogger from "@/utils/logger";
import { parseVersionForUrl } from "@/utils/proxy/api-helpers";

const logger = createLogger("service-helpers");

function parseServicesToGroups(services: unknown): ServiceGroup[] {
    if (!services) {
        return [];
    }

    // map easy to write YAML objects into easy to consume JS arrays
    return (services as ServicesYaml).map((serviceGroup): ServiceGroup => {
        const name = Object.keys(serviceGroup)[0];
        let groups: ServiceGroup[] = [];
        const serviceGroupServices: Service[] = [];
        serviceGroup[name].forEach((entries) => {
            const entryName = Object.keys(entries)[0];
            const entry = entries[entryName];
            if (!entry) {
                logger.warn(`Error parsing service "${entryName}" from config. Ensure required fields are present.`);
                return;
            }
            if (Array.isArray(entry)) {
                groups = groups.concat(parseServicesToGroups([{ [entryName]: entry }]));
            } else {
                serviceGroupServices.push({
                    name: entryName,
                    ...entry,
                    weight: entry.weight ?? (serviceGroupServices.length + 1) * 100, // default weight
                    type: "service",
                });
            }
        });
        return {
            name,
            type: "group",
            services: serviceGroupServices,
            groups,
        };
    });
}

export async function servicesFromConfig() {
    checkAndCopyConfig("services.yaml");

    const servicesYaml = path.join(CONF_DIR, "services.yaml");
    const rawFileContents = await fs.readFile(servicesYaml, "utf8");
    const fileContents = substituteEnvironmentVars(rawFileContents);
    const services = loadYaml(fileContents);
    return parseServicesToGroups(services);
}

function flattenServices(groups: ServiceGroup[], services: Service[] = []) {
    groups.forEach((group) => {
        (group.services ?? []).forEach((service) => services.push(service));
        flattenServices(group.groups ?? [], services);
    });
    return services;
}

function dockerWidgets(service: Service): WidgetConfig[] {
    const widgets = service.widget ? [service.widget, ...(service.widgets ?? [])] : (service.widgets ?? []);
    return widgets.filter((widget) => widget?.type === "docker");
}

export async function containersFromConfig(server?: string) {
    const target = server || "";
    const services = flattenServices(await servicesFromConfig());
    // services and docker widgets both carry container + server
    const refs = services.flatMap((service) => [service, ...dockerWidgets(service)]);
    const matching = refs.flatMap((ref) =>
        typeof ref.container === "string" && ref.container && (ref.server || "") === target ? [ref.container] : []
    );

    return new Set(matching);
}

const LABEL_PREFIX = "foyer.";

// foyer.foo -> foo, foyer.instance.<this instance>.foo -> foo, another instance -> null
export function foyerLabelValue(label: string, instanceName?: string): string | null {
    if (!label.startsWith(LABEL_PREFIX)) return null;

    const value = label.slice(LABEL_PREFIX.length);
    if (!value.startsWith("instance.")) return value;
    if (instanceName && value.startsWith(`instance.${instanceName}.`)) {
        return value.replace(`instance.${instanceName}.`, "");
    }

    return null;
}

// [label, key] pairs that set a container's service
function resolveFoyerLabels(
    containerLabels: Record<string, string> | null | undefined,
    instanceName: string | undefined
) {
    const labels = Object.keys(containerLabels ?? {});
    return labels.flatMap<[string, string]>((label) => {
        const key = foyerLabelValue(label, instanceName);
        if (key === null) return [];
        return [[label, key]];
    });
}

export function hasFoyerLabels(labels: Record<string, string> | null | undefined, instanceName?: string) {
    return resolveFoyerLabels(labels, instanceName).length > 0;
}

function isDiscoveredService(service: Service): service is DiscoveredService {
    return Boolean(service.name && service.group);
}

export async function servicesFromDocker(): Promise<ServiceGroup[]> {
    checkAndCopyConfig("docker.yaml");

    const dockerYaml = path.join(CONF_DIR, "docker.yaml");
    const rawDockerFileContents = await fs.readFile(dockerYaml, "utf8");
    const dockerFileContents = substituteEnvironmentVars(rawDockerFileContents);
    const loaded = loadYaml(dockerFileContents);

    if (!loaded) {
        return [];
    }

    const servers = loaded as DockerServersConfig;
    const { instanceName } = getSettings();

    const serviceServers = await Promise.all(
        Object.keys(servers).map(async (serverName) => {
            try {
                const isSwarm = !!servers[serverName].swarm;
                const docker = new Docker(getDockerArguments(serverName)?.conn);
                const containers = await (isSwarm ? docker.listServices() : docker.listContainers({ all: true }));

                // bad docker connections can result in a <Buffer ...> object?
                // in any case, this ensures the result is the expected array
                if (!Array.isArray(containers)) {
                    return { server: serverName, services: [] };
                }

                const discovered = containers.map((container): DiscoveredService | null => {
                    let constructedService: Service | null = null;
                    const containerLabels = isSwarm
                        ? shvl.get<Record<string, string>>(container, "Spec.Labels")
                        : (container as Docker.ContainerInfo).Labels;
                    const containerName = isSwarm
                        ? shvl.get<string>(container, "Spec.Name")
                        : (container as Docker.ContainerInfo).Names[0];

                    for (const [label, value] of resolveFoyerLabels(containerLabels, instanceName)) {
                        if (!constructedService) {
                            constructedService = {
                                container: containerName.replace(/^\//, ""),
                                server: serverName,
                                weight: 0,
                                type: "service",
                            };
                        }
                        let substitutedVal: string | number | null = substituteEnvironmentVars(containerLabels[label]);
                        if (value === "widget.version" || /^widgets\[\d+\]\.version$/.test(value)) {
                            substitutedVal = parseVersionForUrl(substitutedVal);
                        }
                        shvl.set(constructedService, value, substitutedVal);
                    }

                    if (constructedService && !isDiscoveredService(constructedService)) {
                        logger.error(
                            `Error constructing service using foyer labels for container '${containerName.replace(
                                /^\//,
                                ""
                            )}'. Ensure required labels are present.`
                        );
                        return null;
                    }

                    return constructedService;
                });

                return {
                    server: serverName,
                    services: discovered.filter((filteredService): filteredService is DiscoveredService =>
                        Boolean(filteredService)
                    ),
                };
            } catch (e) {
                logger.error("Error getting services from Docker server '%s': %s", serverName, e);

                // a server failed, but others may succeed
                return { server: serverName, services: [] };
            }
        })
    );

    const mappedServiceGroups: ServiceGroup[] = [];

    serviceServers.forEach((server) => {
        server.services.forEach((serverService) => {
            let serverGroup = mappedServiceGroups.find((searchedGroup) => searchedGroup.name === serverService.group);
            if (!serverGroup) {
                mappedServiceGroups.push({
                    name: serverService.group,
                    services: [],
                });
                serverGroup = mappedServiceGroups[mappedServiceGroups.length - 1];
            }

            const { name: serviceName, group: _serverServiceGroup, ...pushedService } = serverService;
            const result = {
                name: serviceName,
                ...pushedService,
            };

            serverGroup.services.push(result);
        });
    });

    return mappedServiceGroups;
}

export async function servicesFromKubernetes(): Promise<ServiceGroup[]> {
    const { instanceName } = getSettings();

    checkAndCopyConfig("kubernetes.yaml");

    try {
        const kc = getKubeConfig();
        if (!kc) {
            return [];
        }

        // resource lists
        const [ingressList, traefikIngressList, httpRouteList] = await Promise.all([
            kubernetes.listIngress(),
            kubernetes.listTraefikIngress(),
            kubernetes.listHttpRoute(),
        ]);

        const resources = [...ingressList, ...traefikIngressList, ...httpRouteList];

        /* c8 ignore next 3 -- resources is always an array once the spreads succeed */
        if (!resources) {
            return [];
        }
        const services = await Promise.all(
            resources
                .filter((resource) => kubernetes.isDiscoverable(resource, instanceName))
                .map(async (resource) => kubernetes.constructedServiceFromResource(resource))
        );

        // map service groups
        const mappedServiceGroups = services.reduce<ServiceGroup[]>((groups, serverService) => {
            let serverGroup = groups.find((group) => group.name === serverService.group);

            if (!serverGroup) {
                serverGroup = {
                    name: serverService.group,
                    services: [],
                };
                groups.push(serverGroup);
            }

            const { name: serviceName, group: _, ...pushedService } = serverService;

            serverGroup.services.push({
                name: serviceName,
                ...pushedService,
            });

            return groups;
        }, []);

        return mappedServiceGroups;
    } catch (e) {
        if (e) logger.error(e);
        throw e;
    }
}

function parseWeight(weight: unknown): number {
    if (typeof weight === "string") {
        const parsed = parseInt(weight, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return typeof weight === "number" ? weight : 0;
}

type RawServiceInput = {
    name?: string;
    type?: string;
    href?: string;
    description?: string;
    icon?: string;
    weight?: unknown;
    target?: string;
    server?: string;
    container?: string;
    namespace?: string;
    app?: string;
    podSelector?: string;
    ping?: string;
    siteMonitor?: string;
    statusStyle?: string;
    showStats?: unknown;
    proxmox?: { node?: string; vmid?: string | number; type?: string };
    widget?: RawWidgetConfig;
    widgets?: RawWidgetConfig[];
    [key: string]: unknown;
};

type RawServiceGroupInput = {
    name: string;
    type?: string;
    weight?: unknown;
    services: RawServiceInput[];
    groups?: RawServiceGroupInput[];
    [key: string]: unknown;
};

export function cleanServiceGroups(groups: RawServiceGroupInput[]): CleanedServiceGroup[] {
    return groups.map((serviceGroup) => ({
        name: serviceGroup.name,
        services: serviceGroup.services.map((service) => {
            const cleanedService: CleanedService = {
                ...service,
                weight: parseWeight(service.weight),
                showStats: service.showStats !== undefined ? Boolean(JSON.parse(String(service.showStats))) : undefined,
                widget: service.widget as WidgetConfig | undefined,
                widgets: (service.widgets as WidgetConfig[] | undefined) ?? [],
            };
            if (cleanedService.widget) {
                cleanedService.widgets.push(cleanedService.widget);
                delete cleanedService.widget;
            }
            cleanedService.widgets = cleanedService.widgets.map((widgetData: RawWidgetConfig, index) => {
                // whitelisted set of keys to pass to the frontend
                // alphabetical, grouped by widget(s)
                const {
                    // all widgets
                    fields,
                    hideErrors,
                    highlight,
                    type,

                    // arcane
                    env,

                    // azuredevops
                    repositoryId,
                    userEmail,

                    // beszel
                    systemId,

                    // calendar
                    firstDayInWeek,
                    integrations,
                    maxEvents,
                    showTime,
                    previousDays,
                    view,
                    timezone,

                    // coinmarketcap
                    currency,
                    defaultinterval,
                    slugs,
                    symbols,

                    // crowdsec
                    limit24h,

                    // customapi
                    mappings,
                    display,

                    // deluge, qbittorrent
                    enableLeechProgress,
                    enableLeechSize,

                    // diskstation
                    volume,

                    // dispatcharr
                    enableActiveStreams,

                    // docker
                    container,
                    server,

                    // dockhand
                    environment,

                    // emby, jellyfin
                    enableBlocks,
                    enableNowPlaying,
                    enableMediaControl,

                    // emby, jellyfin, tautulli, tracearr
                    enableUser,
                    expandOneStreamToTwoRows,
                    showEpisodeNumber,

                    // feed
                    layout,

                    // frigate
                    enableRecentEvents,

                    // gamedig
                    gameToken,

                    // authentik, beszel, glances, immich, komga, mealie, netalertx, pihole, pfsense, speedtest
                    version,

                    // glances
                    chart,
                    metric,
                    pointsLimit,
                    diskUnits,

                    // glances, customapi, iframe, prometheusmetric
                    refreshInterval,

                    // hdhomerun
                    tuner,

                    // healthchecks
                    uuid,

                    // iframe
                    allowFullscreen,
                    allowPolicy,
                    allowScrolling,
                    classes,
                    loadingStrategy,
                    referrerPolicy,
                    src,

                    // jellystat
                    days,

                    // komodo
                    showSummary,
                    showStacks,

                    // kopia
                    snapshotHost,
                    snapshotPath,

                    // kubernetes
                    app,
                    namespace,
                    podSelector,

                    // livestreamer
                    hideOffline,
                    showPreview,

                    // lubelogger
                    vehicleID,

                    // mjpeg
                    fit,
                    stream,

                    // openmediavault
                    method,

                    // openwrt
                    interfaceName,

                    // opnsense, pfsense
                    wan,

                    // portainer
                    kubernetes,

                    // prometheusmetric
                    metrics,

                    // proxmox
                    node,

                    // proxmoxbackupserver
                    datastore,

                    // qui
                    instance,

                    // releases
                    collapseAfter,
                    showSourceIcon,

                    // speedtest
                    bitratePrecision,

                    // sonarr, radarr
                    enableQueue,

                    // stocks
                    watchlist,
                    showUSMarketStatus,

                    // truenas
                    enablePools,
                    nasType,

                    // unifi
                    site,

                    // unraid
                    pool1,
                    pool2,
                    pool3,
                    pool4,

                    // vikunja
                    enableTaskList,
                    url,

                    // wgeasy
                    threshold,

                    // yourspotify
                    interval,

                    // technitium
                    range,

                    // spoolman
                    spoolIds,

                    // grafana
                    alerts,
                } = widgetData;

                let fieldsList: string[] | null | undefined;
                if (typeof fields === "string") {
                    try {
                        fieldsList = JSON.parse(fields);
                    } catch (e) {
                        logger.error("Invalid fields list detected in config for service '%s'", service.name);
                        fieldsList = null;
                    }
                } else {
                    fieldsList = fields;
                }

                const widget: WidgetConfig = {
                    type,
                    fields: fieldsList || null,
                    hide_errors: hideErrors || false,
                    service_name: service.name,
                    service_group: serviceGroup.name,
                    index,
                };

                if (highlight) {
                    let parsedHighlight: unknown = highlight;
                    if (typeof highlight === "string") {
                        try {
                            parsedHighlight = JSON.parse(highlight);
                        } catch (e) {
                            logger.error(
                                "Invalid highlight configuration detected in config for service '%s'",
                                service.name
                            );
                            parsedHighlight = null;
                        }
                    }
                    if (parsedHighlight && typeof parsedHighlight === "object") {
                        widget.highlight = parsedHighlight;
                    }
                }

                if (type === "azuredevops") {
                    if (userEmail) widget.userEmail = userEmail;
                    if (repositoryId) widget.repositoryId = repositoryId;
                }

                if (type === "arcane") {
                    if (env !== undefined) widget.env = env;
                }

                if (type === "beszel") {
                    if (systemId) widget.systemId = systemId;
                }

                if (type === "coinmarketcap") {
                    if (currency) widget.currency = currency;
                    if (symbols) widget.symbols = symbols;
                    if (slugs) widget.slugs = slugs;
                    if (defaultinterval) widget.defaultinterval = defaultinterval;
                }

                if (limit24h !== undefined) {
                    widget.limit24h = !!limit24h;
                }

                if (type === "docker") {
                    if (server) widget.server = server;
                    if (container) widget.container = container;
                }
                if (type === "unifi") {
                    if (site) widget.site = site;
                }
                if (type === "portainer") {
                    if (kubernetes) widget.kubernetes = !!JSON.parse(kubernetes);
                }
                if (type === "qui") {
                    if (instance !== undefined) widget.instance = instance;
                }
                if (type === "proxmox") {
                    if (node) widget.node = node;
                }
                if (type === "proxmoxbackupserver") {
                    if (datastore) widget.datastore = datastore;
                }
                if (type === "komodo") {
                    if (showSummary !== undefined) widget.showSummary = !!JSON.parse(showSummary);
                    if (showStacks !== undefined) widget.showStacks = !!JSON.parse(showStacks);
                }
                if (type === "kubernetes") {
                    if (namespace) widget.namespace = namespace;
                    if (app) widget.app = app;
                    if (podSelector) widget.podSelector = podSelector;
                }
                if (type === "iframe") {
                    if (src) widget.src = src;
                    if (classes) widget.classes = classes;
                    if (referrerPolicy) widget.referrerPolicy = referrerPolicy;
                    if (allowPolicy) widget.allowPolicy = allowPolicy;
                    if (allowFullscreen) widget.allowFullscreen = allowFullscreen;
                    if (loadingStrategy) widget.loadingStrategy = loadingStrategy;
                    if (allowScrolling) widget.allowScrolling = allowScrolling;
                    if (refreshInterval) widget.refreshInterval = refreshInterval;
                }
                if (["deluge", "qbittorrent"].includes(type)) {
                    if (enableLeechProgress !== undefined) widget.enableLeechProgress = JSON.parse(enableLeechProgress);
                    if (enableLeechSize !== undefined) widget.enableLeechSize = JSON.parse(enableLeechSize);
                }
                if (["opnsense", "pfsense"].includes(type)) {
                    if (wan) widget.wan = wan;
                }
                if (["emby", "jellyfin"].includes(type)) {
                    if (enableMediaControl !== undefined) widget.enableMediaControl = !!JSON.parse(enableMediaControl);
                    if (enableBlocks !== undefined) widget.enableBlocks = JSON.parse(enableBlocks);
                    if (enableNowPlaying !== undefined) widget.enableNowPlaying = JSON.parse(enableNowPlaying);
                }
                if (["emby", "jellyfin", "tautulli", "tracearr"].includes(type)) {
                    if (expandOneStreamToTwoRows !== undefined)
                        widget.expandOneStreamToTwoRows = !!JSON.parse(expandOneStreamToTwoRows);
                    if (showEpisodeNumber !== undefined) widget.showEpisodeNumber = !!JSON.parse(showEpisodeNumber);
                    if (enableUser !== undefined) widget.enableUser = !!JSON.parse(enableUser);
                }
                if (type === "tracearr") {
                    if (view !== undefined) widget.view = view;
                }
                if (["sonarr", "radarr"].includes(type)) {
                    if (enableQueue !== undefined) widget.enableQueue = JSON.parse(enableQueue);
                }
                if (type === "truenas") {
                    if (enablePools !== undefined) widget.enablePools = JSON.parse(enablePools);
                    if (nasType !== undefined) widget.nasType = nasType;
                }
                if (["diskstation", "qnap"].includes(type)) {
                    if (volume) widget.volume = volume;
                }
                if (["dispatcharr"].includes(type)) {
                    if (enableActiveStreams) widget.enableActiveStreams = !!JSON.parse(enableActiveStreams);
                }
                if (type === "gamedig") {
                    if (gameToken) widget.gameToken = gameToken;
                }
                if (type === "kopia") {
                    if (snapshotHost) widget.snapshotHost = snapshotHost;
                    if (snapshotPath) widget.snapshotPath = snapshotPath;
                }
                if (
                    [
                        "authentik",
                        "beszel",
                        "fileflows",
                        "glances",
                        "immich",
                        "jellyfin",
                        "komga",
                        "mealie",
                        "netalertx",
                        "pfsense",
                        "pihole",
                        "speedtest",
                        "wgeasy",
                        "grafana",
                        "gluetun",
                        "vikunja",
                        "pulse",
                    ].includes(type)
                ) {
                    widget.version = parseVersionForUrl(version);
                }
                if (type === "glances") {
                    if (metric) widget.metric = metric;
                    if (chart !== undefined) {
                        widget.chart = chart;
                    } else {
                        widget.chart = true;
                    }
                    if (refreshInterval) widget.refreshInterval = refreshInterval;
                    if (pointsLimit) widget.pointsLimit = pointsLimit;
                    if (diskUnits) widget.diskUnits = diskUnits;
                }
                if (type === "mjpeg") {
                    if (stream) widget.stream = stream;
                    if (fit) widget.fit = fit;
                }
                if (type === "openmediavault") {
                    if (method) widget.method = method;
                }
                if (type === "openwrt") {
                    if (interfaceName) widget.interfaceName = interfaceName;
                }
                if (type === "customapi") {
                    if (mappings) widget.mappings = mappings;
                    if (display) widget.display = display;
                    if (refreshInterval) widget.refreshInterval = refreshInterval;
                }
                if (type === "calendar") {
                    if (integrations) {
                        if (Array.isArray(integrations)) {
                            widget.integrations = integrations.map((integration) => {
                                if (!integration || typeof integration !== "object") {
                                    return integration;
                                }
                                const { url: _url, ...integrationWithoutUrl } = integration;
                                return integrationWithoutUrl;
                            });
                        } else {
                            widget.integrations = integrations;
                        }
                    }
                    if (firstDayInWeek) widget.firstDayInWeek = firstDayInWeek;
                    if (view) widget.view = view;
                    if (maxEvents) widget.maxEvents = maxEvents;
                    if (previousDays) widget.previousDays = previousDays;
                    if (showTime) widget.showTime = showTime;
                    if (timezone) widget.timezone = timezone;
                }
                if (type === "feed") {
                    if (layout) widget.layout = layout;
                }
                if (type === "releases") {
                    if (collapseAfter !== undefined) widget.collapseAfter = collapseAfter;
                    if (showSourceIcon !== undefined) widget.showSourceIcon = showSourceIcon;
                }
                if (type === "dockhand") {
                    if (environment) widget.environment = environment;
                }
                if (type === "hdhomerun") {
                    if (tuner !== undefined) widget.tuner = tuner;
                }
                if (type === "healthchecks") {
                    if (uuid !== undefined) widget.uuid = uuid;
                }
                if (type === "speedtest") {
                    if (bitratePrecision !== undefined) {
                        widget.bitratePrecision = parseInt(bitratePrecision, 10);
                    }
                }
                if (type === "stocks") {
                    if (watchlist) widget.watchlist = watchlist;
                    if (showUSMarketStatus) widget.showUSMarketStatus = showUSMarketStatus;
                }
                if (type === "wgeasy") {
                    if (threshold !== undefined) widget.threshold = parseInt(threshold, 10);
                }
                if (type === "frigate") {
                    if (enableRecentEvents !== undefined) widget.enableRecentEvents = enableRecentEvents;
                }
                if (type === "technitium") {
                    if (node !== undefined) widget.node = node;
                    if (range !== undefined) widget.range = range;
                }
                if (type === "livestreamer") {
                    if (collapseAfter !== undefined) widget.collapseAfter = collapseAfter;
                    if (hideOffline !== undefined) widget.hideOffline = hideOffline;
                    if (showPreview !== undefined) widget.showPreview = showPreview;
                }
                if (type === "lubelogger") {
                    if (vehicleID !== undefined) widget.vehicleID = parseInt(vehicleID, 10);
                }
                if (type === "vikunja") {
                    if (enableTaskList !== undefined) widget.enableTaskList = !!enableTaskList;
                    if (url) widget.url = url;
                }
                if (type === "prometheusmetric") {
                    if (metrics) widget.metrics = metrics;
                    if (refreshInterval) widget.refreshInterval = refreshInterval;
                }
                if (type === "spoolman") {
                    if (spoolIds !== undefined) widget.spoolIds = spoolIds;
                }
                if (type === "jellystat") {
                    if (days !== undefined) widget.days = parseInt(days, 10);
                }
                if (type === "grafana") {
                    if (alerts) widget.alerts = alerts;
                }
                if (type === "unraid") {
                    if (pool1) widget.pool1 = pool1;
                    if (pool2) widget.pool2 = pool2;
                    if (pool3) widget.pool3 = pool3;
                    if (pool4) widget.pool4 = pool4;
                }
                if (type === "yourspotify") {
                    if (interval !== undefined) {
                        widget.interval = interval;
                    }
                }
                return widget;
            });
            return cleanedService;
        }),
        type: serviceGroup.type || "group",
        groups: serviceGroup.groups ? cleanServiceGroups(serviceGroup.groups) : [],
    }));
}

export function findGroupByName(groups: ServiceGroup[], name: string): NestedServiceGroup | null {
    // Deep search for a group by name. Using for loop allows for early return
    for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        if (group.name === name) {
            return group;
        } else if (group.groups) {
            const foundGroup = findGroupByName(group.groups, name);
            if (foundGroup) {
                foundGroup.parent = group.name;
                return foundGroup;
            }
        }
    }
    return null;
}

export async function getServiceItem(group: ApiQueryValue, service: ApiQueryValue) {
    if (typeof group !== "string" || typeof service !== "string") {
        return false;
    }

    const configuredServices = await servicesFromConfig();

    const serviceGroup = findGroupByName(configuredServices, group);
    if (serviceGroup) {
        const serviceEntry = serviceGroup.services.find((s) => s.name === service);
        if (serviceEntry) return serviceEntry;
    }

    const discoveredServices = await servicesFromDocker();

    const dockerServiceGroup = findGroupByName(discoveredServices, group);
    if (dockerServiceGroup) {
        const dockerServiceEntry = dockerServiceGroup.services.find((s) => s.name === service);
        if (dockerServiceEntry) return dockerServiceEntry;
    }

    const kubernetesServices = await servicesFromKubernetes();
    const kubernetesServiceGroup = findGroupByName(kubernetesServices, group);
    if (kubernetesServiceGroup) {
        const kubernetesServiceEntry = kubernetesServiceGroup.services.find((s) => s.name === service);
        if (kubernetesServiceEntry) return kubernetesServiceEntry;
    }

    return false;
}

// `index` comes straight from the request query, so it may be a string
export default async function getServiceWidget<O extends object = object>(
    group: ApiQueryValue,
    service: ApiQueryValue,
    index?: ApiQueryValue | number
): Promise<(WidgetConfig & O) | undefined> {
    const serviceItem = await getServiceItem(group, service);
    if (serviceItem) {
        const { widget, widgets } = serviceItem;
        const resolved = Number(index) > -1 && widgets ? widgets[Number(index)] : widget;
        return resolved as (WidgetConfig & O) | undefined;
    }
    return undefined;
}
