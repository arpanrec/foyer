import type Docker from "dockerode";

import type { JsonValue } from "@/types/json";
import type { Service, ServiceGroup, WidgetConfig } from "@/types/service";

// `getConfig` returns `unknown`; these are the shapes the config loaders narrow it to.

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The key and value of a single-key config object such as `{ "Group name": [...] }`; undefined when it is empty
export function firstEntry<V>(record: Record<string, V>): [string, V] | undefined {
    return Object.entries(record)[0];
}

// docker config: one entry per server name
export type DockerServerConfig = {
    socket?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    swarm?: boolean | undefined;
    protocol?: Docker.DockerOptions["protocol"] | undefined;
    headers?: Record<string, string> | undefined;
    tls?: { caFile: string; certFile: string; keyFile: string } | undefined;
};

export type DockerServersConfig = Record<string, DockerServerConfig>;

// kubernetes config
export type KubernetesConfig = {
    mode?: string | undefined;
    ingress?: boolean | undefined;
    traefik?: boolean | undefined;
    gateway?: boolean | undefined;
};

// proxmox config: one entry per node name, or url, token and secret at the top level for every node
export type ProxmoxNodeConfig = { url?: string | undefined; token?: string | undefined; secret?: string | undefined };
export type ProxmoxConfig = Record<string, ProxmoxNodeConfig | string | undefined>;

// widgets config: a list of single-key objects, the key being the widget type
export type WidgetsConfig = Record<string, Record<string, unknown> | null>[];

// The options of one widgets config entry. The first fields are the private ones the widget handlers read.
export type ConfiguredWidgetOptions = {
    index: number;
    url?: string | undefined;
    username?: string | undefined;
    password?: string | undefined;
    key?: string | undefined;
    apiKey?: string | undefined;
    headers?: Record<string, string> | undefined;
    requestBody?: JsonValue | undefined;
    method?: string | undefined;
    [option: string]: unknown;
};

export type ConfiguredWidget = { type: string; options: ConfiguredWidgetOptions };

// bookmarks config: groups of single-key bookmark objects, each holding a one-item list
export type BookmarksConfig = Record<string, Record<string, Record<string, unknown>[]>[]>[];

// services config: groups of single-key service objects; a service whose value is a list is a nested group
export type ServiceEntryConfig = { [name: string]: Service | null | ServiceEntryConfig[] };
export type ServicesConfig = Record<string, ServiceEntryConfig[]>[];

// A service found through Docker labels or Kubernetes annotations, which always carry a name and a group
export type DiscoveredService = {
    name: string;
    group: string;
    widget?: WidgetConfig | undefined;
    widgets?: WidgetConfig[] | undefined;
    [option: string]: unknown;
};

// What cleanServiceGroups returns: every service has a widgets list
export type CleanedService = Service & { weight: number; widgets: WidgetConfig[] };
export type CleanedServiceGroup = ServiceGroup & { services: CleanedService[]; groups: CleanedServiceGroup[] };

// A group that findGroupByName found inside another one
export type NestedServiceGroup = ServiceGroup & { parent?: string | undefined };

// What bookmarksResponse returns
export type Bookmark = { name: string; [option: string]: unknown };
export type BookmarkGroup = { name: string; bookmarks: Bookmark[] };

// A widget as it comes from the services config, Docker labels or Kubernetes annotations. Labels and annotations
// carry every value as a string, so the options cleaned below may be JSON text.
export type RawWidgetConfig = {
    type: string;
    service_name?: string | undefined;
    service_group?: string | undefined;
    index?: number | string | undefined;
    url?: string | undefined;
    fields?: string | string[] | null | undefined;
    highlight?: unknown;
    hide_errors?: boolean | undefined;
    hideErrors?: boolean | undefined;
    key?: string | undefined;
    username?: string | undefined;
    password?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    requestBody?: JsonValue | undefined;
    refreshInterval?: number | undefined;
    kubernetes?: string | undefined;
    showSummary?: string | undefined;
    showStacks?: string | undefined;
    enableLeechProgress?: string | undefined;
    enableLeechSize?: string | undefined;
    enableMediaControl?: string | undefined;
    enableBlocks?: string | undefined;
    enableNowPlaying?: string | undefined;
    expandOneStreamToTwoRows?: string | undefined;
    showEpisodeNumber?: string | undefined;
    enableUser?: string | undefined;
    enableQueue?: string | undefined;
    enablePools?: string | undefined;
    enableActiveStreams?: string | undefined;
    bitratePrecision?: string | undefined;
    threshold?: string | undefined;
    vehicleID?: string | undefined;
    days?: string | undefined;
    [option: string]: unknown;
};
