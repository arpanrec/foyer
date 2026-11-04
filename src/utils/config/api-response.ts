import type { Service, ServiceGroup } from "@/types/service";
import {
    cleanServiceGroups,
    findGroupByName,
    servicesFromConfig,
    servicesFromDocker,
    servicesFromKubernetes,
} from "@/utils/config/service-helpers";
import { getSettings, type AppSettings } from "@/utils/config/settings";
import { getConfig } from "@/utils/config/store";
import {
    firstEntry,
    isRecord,
    type Bookmark,
    type BookmarkGroup,
    type BookmarksConfig,
    type ConfiguredWidget,
    type NestedServiceGroup,
} from "@/utils/config/types";
import { cleanWidgetGroups, widgetsFromConfig } from "@/utils/config/widget-helpers";
import { allowImageUrlsIn } from "@/utils/image-allowlist";
import createLogger from "@/utils/logger";
import warnOnce from "@/utils/warn-once";

const logger = createLogger("apiResponse");

/**
 * Compares services by weight then by name.
 */
function compareServices(service1: Service, service2: Service) {
    const comp = (service1.weight ?? 0) - (service2.weight ?? 0);
    if (comp !== 0) {
        return comp;
    }
    return (service1.name ?? "").localeCompare(service2.name ?? "");
}

export async function bookmarksResponse() {
    const bookmarks = (await getConfig("bookmarks")) as BookmarksConfig | undefined;

    if (!bookmarks) return [];

    let initialSettings: AppSettings;

    try {
        initialSettings = await getSettings();
    } catch (e) {
        logger.error("Failed to load the settings, please check them for errors: %s", e);
        initialSettings = {};
    }

    // map single-key config objects into easy to consume JS arrays
    // an empty group or bookmark object has no name, so it is left out. The config file is not type checked at run
    // time, so any entry of the wrong shape is left out with a warning, and the other bookmarks still load.
    const bookmarksArray = bookmarks.flatMap((group): BookmarkGroup[] => {
        if (!isRecord(group)) {
            warnOnce(logger, "Skipping a bookmark group that is not an object in the bookmarks config");
            return [];
        }
        const groupEntry = firstEntry(group);
        if (!groupEntry) {
            warnOnce(logger, "Skipping an empty bookmark group in the bookmarks config");
            return [];
        }
        const [name, entries] = groupEntry;
        if (!Array.isArray(entries)) {
            warnOnce(logger, "Skipping bookmark group '%s': its value must be a list of bookmarks", name);
            return [];
        }
        return [
            {
                name,
                bookmarks: entries.flatMap((bookmarkEntries): Bookmark[] => {
                    if (!isRecord(bookmarkEntries)) {
                        warnOnce(logger, "Skipping a bookmark that is not an object in bookmark group '%s'", name);
                        return [];
                    }
                    const bookmarkEntry = firstEntry(bookmarkEntries);
                    if (!bookmarkEntry) {
                        warnOnce(logger, "Skipping an empty bookmark in bookmark group '%s'", name);
                        return [];
                    }
                    const [bookmarkName, value] = bookmarkEntry;
                    const bookmark: unknown = Array.isArray(value) ? value[0] : undefined;
                    if (!isRecord(bookmark)) {
                        warnOnce(
                            logger,
                            "Skipping bookmark '%s' in bookmark group '%s': its value must be a list holding one object",
                            bookmarkName,
                            name
                        );
                        return [];
                    }
                    return [{ name: bookmarkName, ...bookmark }];
                }),
            },
        ];
    });

    const sortedGroups: BookmarkGroup[] = [];
    const unsortedGroups: BookmarkGroup[] = [];
    const definedLayouts = initialSettings.layout ? Object.keys(initialSettings.layout) : null;

    bookmarksArray.forEach((group) => {
        if (definedLayouts) {
            const layoutIndex = definedLayouts.findIndex((layout) => layout === group.name);
            if (layoutIndex > -1) sortedGroups[layoutIndex] = group;
            else unsortedGroups.push(group);
        } else {
            unsortedGroups.push(group);
        }
    });

    return [...sortedGroups.filter((g) => g), ...unsortedGroups];
}

export async function widgetsResponse() {
    let configuredWidgets: Promise<ConfiguredWidget[]> | ConfiguredWidget[];

    try {
        configuredWidgets = cleanWidgetGroups(await widgetsFromConfig());
    } catch (e) {
        logger.error("Failed to load the widgets, please check them for errors: %s", e);
        configuredWidgets = [];
    }

    return configuredWidgets;
}

function convertLayoutGroupToGroup(name: string, layoutGroup: unknown): ServiceGroup {
    const groups: ServiceGroup[] = [];
    const group: ServiceGroup = { name, services: [], groups };
    if (typeof layoutGroup === "object" && layoutGroup !== null) {
        Object.entries(layoutGroup).forEach(([key, value]) => {
            if (typeof value === "object") {
                groups.push(convertLayoutGroupToGroup(key, value));
            }
        });
    }
    return group;
}

function mergeSubgroups(configuredGroups: ServiceGroup[], mergedGroup: ServiceGroup) {
    configuredGroups.forEach((group) => {
        if (group.name === mergedGroup.name) {
            group.services = mergedGroup.services;
        } else if (group.groups) {
            mergeSubgroups(group.groups, mergedGroup);
        }
    });
}

function ensureParentGroupExists(
    sortedGroups: (ServiceGroup | null)[],
    configuredGroups: ServiceGroup[],
    group: NestedServiceGroup,
    definedLayouts: string[]
) {
    // make sure the top level parent group exists in the sortedGroups array
    const parentGroupName = group.parent as string;
    const parentGroup = findGroupByName(configuredGroups, parentGroupName);
    if (parentGroup && parentGroup.parent) {
        ensureParentGroupExists(sortedGroups, configuredGroups, parentGroup, definedLayouts);
    } else {
        const parentGroupIndex = definedLayouts.findIndex((layout) => layout === parentGroupName);
        if (parentGroupIndex > -1) {
            sortedGroups[parentGroupIndex] = parentGroup;
        }
    }
}

function pruneEmptyGroups(groups: ServiceGroup[]): ServiceGroup[] {
    // remove any groups that have no services
    return groups.filter((group) => {
        const subgroups = group.groups ?? [];
        if (group.services.length === 0 && subgroups.length === 0) {
            return false;
        }
        if (subgroups.length > 0) {
            group.groups = pruneEmptyGroups(subgroups);
        }
        return true;
    });
}

function mergeLayoutGroupsIntoConfigured(configuredGroups: ServiceGroup[], layoutGroups: ServiceGroup[]) {
    for (const layoutGroup of layoutGroups) {
        const existing = findGroupByName(configuredGroups, layoutGroup.name);
        if (existing) {
            if (layoutGroup.groups?.length) {
                existing.groups ??= [];
                for (const sub of layoutGroup.groups) {
                    const existingSub = findGroupByName(existing.groups, sub.name);
                    if (!existingSub) {
                        existing.groups.push(sub);
                    } else {
                        // recursive merge if needed
                        mergeLayoutGroupsIntoConfigured([existingSub], [sub]);
                    }
                }
            }
        } else {
            configuredGroups.push(layoutGroup);
        }
    }
}

export async function servicesResponse() {
    let discoveredDockerServices: ServiceGroup[];
    let discoveredKubernetesServices: ServiceGroup[];
    let configuredServices: ServiceGroup[];
    let initialSettings: AppSettings;

    try {
        discoveredDockerServices = cleanServiceGroups(await servicesFromDocker());
        if (discoveredDockerServices?.length === 0) {
            logger.debug("No containers were found with foyer labels.");
        }
    } catch (e) {
        logger.error("Failed to discover Docker services, please check the docker config for errors: %s", e);
        discoveredDockerServices = [];
    }

    try {
        discoveredKubernetesServices = cleanServiceGroups(await servicesFromKubernetes());
    } catch (e) {
        logger.error("Failed to discover Kubernetes services, please check the kubernetes config for errors: %s", e);
        discoveredKubernetesServices = [];
    }

    try {
        configuredServices = cleanServiceGroups(await servicesFromConfig());
    } catch (e) {
        logger.error("Failed to load the services, please check them for errors: %s", e);
        configuredServices = [];
    }

    try {
        initialSettings = await getSettings();
    } catch (e) {
        logger.error("Failed to load the settings, please check them for errors: %s", e);
        initialSettings = {};
    }

    const mergedGroupsNames = [
        ...new Set(
            [
                discoveredDockerServices.map((group) => group.name),
                discoveredKubernetesServices.map((group) => group.name),
                configuredServices.map((group) => group.name),
            ].flat()
        ),
    ];

    const sortedGroups: ServiceGroup[] = [];
    const unsortedGroups: ServiceGroup[] = [];
    const definedLayouts = initialSettings.layout ? Object.keys(initialSettings.layout) : null;
    if (definedLayouts) {
        // this handles cases where groups are only defined in the settings layout and not in the services config
        const layoutGroups = Object.entries(initialSettings.layout ?? {}).map(([key, value]) =>
            convertLayoutGroupToGroup(key, value)
        );
        mergeLayoutGroupsIntoConfigured(configuredServices, layoutGroups);
    }

    mergedGroupsNames.forEach((groupName) => {
        const emptyGroup: ServiceGroup = { name: groupName, services: [], groups: [] };
        const discoveredDockerGroup = findGroupByName(discoveredDockerServices, groupName) || emptyGroup;
        const discoveredKubernetesGroup = findGroupByName(discoveredKubernetesServices, groupName) || emptyGroup;
        const configuredGroup = findGroupByName(configuredServices, groupName) || emptyGroup;

        const mergedGroup = {
            name: groupName,
            services: [
                ...discoveredDockerGroup.services,
                ...discoveredKubernetesGroup.services,
                ...configuredGroup.services,
            ]
                .filter((service) => service)
                .sort(compareServices),
            groups: [...(configuredGroup.groups ?? [])],
        };

        if (definedLayouts) {
            const layoutIndex = definedLayouts.findIndex((layout) => layout === mergedGroup.name);
            if (layoutIndex > -1) sortedGroups[layoutIndex] = mergedGroup;
            else if (configuredGroup["parent"]) {
                // this is a nested group, so find the parent group and merge the services
                mergeSubgroups(configuredServices, mergedGroup);
                // make sure the top level parent group exists in the sortedGroups array
                ensureParentGroupExists(sortedGroups, configuredServices, configuredGroup, definedLayouts);
            } else unsortedGroups.push(mergedGroup);
        } else if (configuredGroup["parent"]) {
            // this is a nested group, so find the parent group and merge the services
            mergeSubgroups(configuredServices, mergedGroup);
        } else {
            unsortedGroups.push(mergedGroup);
        }
    });

    // icons of discovered services are not in the config file, so the image proxy learns them here
    await Promise.all([allowImageUrlsIn(discoveredDockerServices), allowImageUrlsIn(discoveredKubernetesServices)]);

    const allGroups = [...sortedGroups.filter((g) => g), ...unsortedGroups];
    return pruneEmptyGroups(allGroups);
}
