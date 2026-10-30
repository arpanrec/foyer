import type Docker from "dockerode";

import type { JsonValue } from "@/types/json";
import type { Service, ServiceGroup, WidgetConfig } from "@/types/service";

// `loadYaml` returns `unknown`; these are the shapes the config loaders narrow it to.

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// docker.yaml: one entry per server name
export type DockerServerConfig = {
    socket?: string;
    host?: string;
    port?: number;
    swarm?: boolean;
    protocol?: Docker.DockerOptions["protocol"];
    headers?: Record<string, string>;
    tls?: { caFile: string; certFile: string; keyFile: string };
};

export type DockerServersConfig = Record<string, DockerServerConfig>;

// kubernetes.yaml
export type KubernetesConfig = {
    mode?: string;
    ingress?: boolean;
    traefik?: boolean;
    gateway?: boolean;
};

// widgets.yaml: a list of single-key objects, the key being the widget type
export type WidgetsYaml = Record<string, Record<string, unknown> | null>[];

// The options of one widgets.yaml entry. The first fields are the private ones the widget handlers read.
export type ConfiguredWidgetOptions = {
    index: number;
    url?: string;
    username?: string;
    password?: string;
    key?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    requestBody?: JsonValue;
    method?: string;
    [option: string]: unknown;
};

export type ConfiguredWidget = { type: string; options: ConfiguredWidgetOptions };

// bookmarks.yaml: groups of single-key bookmark objects, each holding a one-item list
export type BookmarksYaml = Record<string, Record<string, Record<string, unknown>[]>[]>[];

// services.yaml: groups of single-key service objects; a service whose value is a list is a nested group
export type ServiceEntryYaml = { [name: string]: Service | null | ServiceEntryYaml[] };
export type ServicesYaml = Record<string, ServiceEntryYaml[]>[];

// A service found through Docker labels or Kubernetes annotations, which always carry a name and a group
export type DiscoveredService = {
    name: string;
    group: string;
    widget?: WidgetConfig;
    widgets?: WidgetConfig[];
    [option: string]: unknown;
};

// What cleanServiceGroups returns: every service has a widgets list
export type CleanedService = Service & { weight: number; widgets: WidgetConfig[] };
export type CleanedServiceGroup = ServiceGroup & { services: CleanedService[]; groups: CleanedServiceGroup[] };

// A group that findGroupByName found inside another one
export type NestedServiceGroup = ServiceGroup & { parent?: string };

// What bookmarksResponse returns
export type Bookmark = { name: string; [option: string]: unknown };
export type BookmarkGroup = { name: string; bookmarks: Bookmark[] };

// A widget as it comes from YAML, Docker labels or Kubernetes annotations. Labels and annotations
// carry every value as a string, so the options cleaned below may be JSON text.
export type RawWidgetConfig = {
    type: string;
    service_name?: string;
    service_group?: string;
    index?: number | string;
    url?: string;
    fields?: string | string[] | null;
    highlight?: unknown;
    hide_errors?: boolean;
    hideErrors?: boolean;
    key?: string;
    username?: string;
    password?: string;
    headers?: Record<string, string>;
    method?: string;
    requestBody?: JsonValue;
    refreshInterval?: number;
    kubernetes?: string;
    showSummary?: string;
    showStacks?: string;
    enableLeechProgress?: string;
    enableLeechSize?: string;
    enableMediaControl?: string;
    enableBlocks?: string;
    enableNowPlaying?: string;
    expandOneStreamToTwoRows?: string;
    showEpisodeNumber?: string;
    enableUser?: string;
    enableQueue?: string;
    enablePools?: string;
    enableActiveStreams?: string;
    bitratePrecision?: string;
    threshold?: string;
    vehicleID?: string;
    days?: string;
    [option: string]: unknown;
};
