import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Service, ServiceGroup } from "@/types/service";
import type { NestedServiceGroup } from "@/utils/config/types";

const { store, config, widgetHelpers, serviceHelpers } = vi.hoisted(() => ({
    store: {
        getConfig: vi.fn(),
    },
    config: {
        getSettings: vi.fn(),
    },
    widgetHelpers: {
        widgetsFromConfig: vi.fn(),
        cleanWidgetGroups: vi.fn(),
    },
    serviceHelpers: {
        servicesFromDocker: vi.fn(),
        servicesFromKubernetes: vi.fn(),
        servicesFromConfig: vi.fn(),
        cleanServiceGroups: vi.fn((g) => g),
        findGroupByName: vi.fn(),
    },
}));

const { logger } = vi.hoisted(() => ({ logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

vi.mock("@/utils/config/store", () => ({ getConfig: store.getConfig }));
vi.mock("@/utils/logger", () => ({ default: () => logger }));

vi.mock("@/utils/config/settings", () => config);
vi.mock("@/utils/config/widget-helpers", () => widgetHelpers);
vi.mock("@/utils/config/service-helpers", () => serviceHelpers);

import { bookmarksResponse, servicesResponse, widgetsResponse } from "@/utils/config/api-response";

describe("utils/config/api-response", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("bookmarksResponse returns [] when bookmarks are missing", async () => {
        store.getConfig.mockReturnValueOnce(null);

        const res = await bookmarksResponse();
        expect(res).toEqual([]);
        expect(config.getSettings).not.toHaveBeenCalled();
    });

    it("bookmarksResponse falls back when settings cannot be loaded", async () => {
        config.getSettings.mockRejectedValueOnce(new Error("bad settings"));
        store.getConfig.mockReturnValueOnce([{ A: [{ LinkA: [{ href: "a" }] }] }, { B: [{ LinkB: [{ href: "b" }] }] }]);

        const res = await bookmarksResponse();
        expect(res.map((g) => g.name)).toEqual(["A", "B"]);
        expect(logger.error).toHaveBeenCalled();
    });

    it("bookmarksResponse sorts groups based on settings layout", async () => {
        config.getSettings.mockResolvedValueOnce({ layout: { B: {}, A: {} } });
        store.getConfig.mockReturnValueOnce([{ A: [{ LinkA: [{ href: "a" }] }] }, { B: [{ LinkB: [{ href: "b" }] }] }]);

        const res = await bookmarksResponse();
        expect(res.map((g) => g.name)).toEqual(["B", "A"]);
    });

    it("bookmarksResponse appends groups not present in the layout", async () => {
        config.getSettings.mockResolvedValueOnce({ layout: { A: {} } });
        store.getConfig.mockReturnValueOnce([{ A: [{ LinkA: [{ href: "a" }] }] }, { C: [{ LinkC: [{ href: "c" }] }] }]);

        const res = await bookmarksResponse();
        expect(res.map((g) => g.name)).toEqual(["A", "C"]);
    });

    it("bookmarksResponse leaves out empty group and bookmark objects", async () => {
        config.getSettings.mockResolvedValueOnce({});
        store.getConfig.mockReturnValueOnce([{}, { A: [{}, { LinkA: [{ href: "a" }] }] }]);

        const res = await bookmarksResponse();
        expect(res).toEqual([{ name: "A", bookmarks: [{ name: "LinkA", href: "a" }] }]);
    });

    it("bookmarksResponse leaves out entries of the wrong shape, with a warning, and keeps the rest", async () => {
        config.getSettings.mockResolvedValueOnce({});
        store.getConfig.mockReturnValueOnce([
            null,
            "Loose",
            { Flat: { Github: [{ href: "g" }] } },
            {
                A: [
                    null,
                    { Github: { href: "https://github.com" } },
                    { Empty: [] },
                    { Text: ["t"] },
                    { LinkA: [{ href: "a" }] },
                ],
            },
        ]);

        const res = await bookmarksResponse();
        expect(res).toEqual([{ name: "A", bookmarks: [{ name: "LinkA", href: "a" }] }]);
        expect(logger.warn).toHaveBeenCalledWith(
            "Skipping a bookmark group that is not an object in the bookmarks config"
        );
        expect(logger.warn).toHaveBeenCalledWith(
            "Skipping bookmark group '%s': its value must be a list of bookmarks",
            "Flat"
        );
        expect(logger.warn).toHaveBeenCalledWith(
            "Skipping a bookmark that is not an object in bookmark group '%s'",
            "A"
        );
        for (const bookmark of ["Github", "Empty", "Text"]) {
            expect(logger.warn).toHaveBeenCalledWith(
                "Skipping bookmark '%s' in bookmark group '%s': its value must be a list holding one object",
                bookmark,
                "A"
            );
        }
    });

    it("widgetsResponse returns sanitized configured widgets", async () => {
        widgetHelpers.widgetsFromConfig.mockResolvedValueOnce([{ type: "search", options: { url: "x" } }]);
        widgetHelpers.cleanWidgetGroups.mockResolvedValueOnce([{ type: "search", options: { index: 0 } }]);

        expect(await widgetsResponse()).toEqual([{ type: "search", options: { index: 0 } }]);
    });

    it("widgetsResponse returns [] when widgets cannot be loaded", async () => {
        widgetHelpers.widgetsFromConfig.mockRejectedValueOnce(new Error("bad widgets"));

        expect(await widgetsResponse()).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
    });

    it("servicesResponse merges groups and sorts services by weight then name", async () => {
        // Minimal stubs for findGroupByName used within servicesResponse.
        serviceHelpers.findGroupByName.mockImplementation(
            (groups: ServiceGroup[], name: string) => groups.find((g) => g.name === name) ?? null
        );

        serviceHelpers.servicesFromDocker.mockResolvedValueOnce([
            {
                name: "GroupA",
                services: [
                    { name: "b", weight: 200 },
                    { name: "a", weight: 200 },
                ],
                groups: [],
            },
        ]);
        serviceHelpers.servicesFromKubernetes.mockResolvedValueOnce([
            { name: "GroupA", services: [{ name: "c", weight: 100 }], groups: [] },
        ]);
        serviceHelpers.servicesFromConfig.mockResolvedValueOnce([
            { name: "GroupA", services: [{ name: "d", weight: 50 }], groups: [] },
            { name: "Empty", services: [], groups: [] },
        ]);

        config.getSettings.mockResolvedValueOnce({ layout: { GroupA: {}, GroupB: {} } });

        const groups = await servicesResponse();
        expect(groups.map((g) => g.name)).toEqual(["GroupA"]);
        expect(groups[0]!.services.map((s: Service) => s.name)).toEqual(["d", "c", "a", "b"]);
    });

    it("servicesResponse logs when no docker services are discovered", async () => {
        serviceHelpers.findGroupByName.mockImplementation(
            (groups: ServiceGroup[], name: string) => groups.find((g) => g.name === name) ?? null
        );

        serviceHelpers.servicesFromDocker.mockResolvedValueOnce([]);
        serviceHelpers.servicesFromKubernetes.mockResolvedValueOnce([]);
        serviceHelpers.servicesFromConfig.mockResolvedValueOnce([]);
        config.getSettings.mockResolvedValueOnce({});

        const groups = await servicesResponse();

        expect(groups).toEqual([]);
        expect(logger.debug).toHaveBeenCalledWith("No containers were found with foyer labels.");
    });

    it("servicesResponse tolerates discovery/load failures and returns [] when nothing can be loaded", async () => {
        serviceHelpers.servicesFromDocker.mockRejectedValueOnce(new Error("docker bad"));
        serviceHelpers.servicesFromKubernetes.mockRejectedValueOnce(new Error("kube bad"));
        serviceHelpers.servicesFromConfig.mockRejectedValueOnce(new Error("config bad"));
        config.getSettings.mockRejectedValueOnce(new Error("settings bad"));

        const groups = await servicesResponse();
        expect(groups).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
    });

    it("servicesResponse supports multi-level nested layout groups and ensures the top-level parent exists", async () => {
        serviceHelpers.findGroupByName.mockImplementation(function find(
            groups: NestedServiceGroup[] | undefined,
            name: string,
            parent?: string
        ): NestedServiceGroup | null {
            for (const group of groups ?? []) {
                if (group.name === name) {
                    if (parent) group.parent = parent;
                    return group;
                }
                const found = find(group.groups, name, group.name);
                if (found) return found;
            }
            return null;
        });

        serviceHelpers.servicesFromDocker.mockResolvedValueOnce([
            { name: "Child", services: [{ name: "svc", weight: 1 }], groups: [] },
        ]);
        serviceHelpers.servicesFromKubernetes.mockResolvedValueOnce([]);
        serviceHelpers.servicesFromConfig.mockResolvedValueOnce([{ name: "Root", services: [], groups: [] }]);

        config.getSettings.mockResolvedValueOnce({ layout: { Root: { Top: { Child: {} } } } });

        const groups = await servicesResponse();

        expect(groups.map((g) => g.name)).toEqual(["Root"]);
        expect(groups[0]!.groups?.[0]!.name).toBe("Top");
        expect(groups[0]!.groups?.[0]!.groups?.[0]!.name).toBe("Child");
        expect(groups[0]!.groups?.[0]!.groups?.[0]!.services).toEqual([{ name: "svc", weight: 1 }]);
    });

    it("servicesResponse merges discovered nested groups into their configured parent layout group", async () => {
        serviceHelpers.findGroupByName.mockImplementation(function find(
            groups: NestedServiceGroup[] | undefined,
            name: string,
            parent?: string
        ): NestedServiceGroup | null {
            for (const group of groups ?? []) {
                if (group.name === name) {
                    if (parent) group.parent = parent;
                    return group;
                }
                const found = find(group.groups, name, group.name);
                if (found) return found;
            }
            return null;
        });

        serviceHelpers.servicesFromDocker.mockResolvedValueOnce([
            {
                name: "Child",
                services: [
                    { name: "svcB", weight: 50 },
                    { name: "svcA", weight: 10 },
                ],
                groups: [],
            },
        ]);
        serviceHelpers.servicesFromKubernetes.mockResolvedValueOnce([]);
        serviceHelpers.servicesFromConfig.mockResolvedValueOnce([
            {
                name: "Top",
                services: [],
                groups: [{ name: "Child", services: [], groups: [] }],
            },
        ]);

        config.getSettings.mockResolvedValueOnce({ layout: { Top: { Child: {} } } });

        const groups = await servicesResponse();

        expect(groups.map((g) => g.name)).toEqual(["Top"]);
        expect(groups[0]!.groups).toHaveLength(1);
        expect(groups[0]!.groups?.[0]!.name).toBe("Child");
        expect(groups[0]!.groups?.[0]!.services.map((s: Service) => s.name)).toEqual(["svcA", "svcB"]);
    });

    it("servicesResponse merges nested discovered groups into their configured parent when no layout is defined", async () => {
        serviceHelpers.findGroupByName.mockImplementation(function find(
            groups: NestedServiceGroup[] | undefined,
            name: string,
            parent?: string
        ): NestedServiceGroup | null {
            for (const group of groups ?? []) {
                if (group.name === name) {
                    if (parent) group.parent = parent;
                    return group;
                }
                const found = find(group.groups, name, group.name);
                if (found) return found;
            }
            return null;
        });

        serviceHelpers.servicesFromDocker.mockResolvedValueOnce([
            { name: "Child", services: [{ name: "svc", weight: 1 }], groups: [] },
        ]);
        serviceHelpers.servicesFromKubernetes.mockResolvedValueOnce([]);
        serviceHelpers.servicesFromConfig.mockResolvedValueOnce([
            { name: "Top", services: [], groups: [{ name: "Child", services: [], groups: [] }] },
        ]);
        config.getSettings.mockResolvedValueOnce({});

        const groups = await servicesResponse();

        expect(groups.map((g) => g.name)).toEqual(["Top"]);
        expect(groups[0]!.groups?.[0]!.name).toBe("Child");
        expect(groups[0]!.groups?.[0]!.services).toEqual([{ name: "svc", weight: 1 }]);
    });
});
