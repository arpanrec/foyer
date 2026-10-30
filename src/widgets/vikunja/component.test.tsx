// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";
import { expectBlockValue } from "@/test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("@/utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "@/widgets/vikunja/component";

describe("widgets/vikunja/component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders placeholders while loading", () => {
        useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

        const { container } = renderWithProviders(<Component service={{ widget: { type: "vikunja" } }} />, {
            settings: { hideErrors: false },
        });

        expect(container.querySelectorAll(".service-block")).toHaveLength(4);
        expect(screen.getByText("vikunja.projects")).toBeInTheDocument();
        expect(screen.getByText("vikunja.tasks7d")).toBeInTheDocument();
        expect(screen.getByText("vikunja.tasksOverdue")).toBeInTheDocument();
        expect(screen.getByText("vikunja.tasksInProgress")).toBeInTheDocument();
    });

    it("computes project/task stats when loaded", () => {
        useWidgetAPI.mockImplementation((_widget, endpoint) => {
            if (endpoint === "projects") return { data: [{ id: 1 }, { id: -1 }], error: undefined };
            if (endpoint === "tasks") {
                return {
                    data: [
                        { dueDateIsDefault: false, dueDate: "2020-01-02T00:00:00Z", inProgress: true },
                        { dueDateIsDefault: false, dueDate: "2019-12-31T00:00:00Z", inProgress: false },
                        { dueDateIsDefault: true, dueDate: "2099-01-01T00:00:00Z", inProgress: false },
                    ],
                    error: undefined,
                };
            }
            return { data: undefined, error: undefined };
        });

        const { container } = renderWithProviders(<Component service={{ widget: { type: "vikunja" } }} />, {
            settings: { hideErrors: false },
        });

        // projects filters id > 0 => 1
        expectBlockValue(container, "vikunja.projects", 1);
        // tasks7d includes both non-default dueDate tasks (both <= one week)
        expectBlockValue(container, "vikunja.tasks7d", 2);
        // overdue includes dueDate <= now => 1 (2019-12-31)
        expectBlockValue(container, "vikunja.tasksOverdue", 1);
        // inProgress => 1
        expectBlockValue(container, "vikunja.tasksInProgress", 1);
    });

    it("renders clickable task list items pointing to service.href", () => {
        useWidgetAPI.mockImplementation((_widget, endpoint) => {
            if (endpoint === "projects") return { data: [{ id: 1 }], error: undefined };
            if (endpoint === "tasks") {
                return {
                    data: [
                        { id: 42, title: "Do homework", dueDateIsDefault: false, dueDate: "2020-01-02T00:00:00Z" },
                        { id: 43, title: "Buy groceries", dueDateIsDefault: true, dueDate: "0001-01-01T00:00:00Z" },
                    ],
                    error: undefined,
                };
            }
            return { data: undefined, error: undefined };
        });

        const { container } = renderWithProviders(
            <Component
                service={{
                    href: "https://vikunja.example.com/",
                    widget: { type: "vikunja", enableTaskList: true },
                }}
            />,
            { settings: { hideErrors: false } }
        );

        const links = container.querySelectorAll("a[href]");
        expect(links).toHaveLength(2);

        expect(links[0]).toHaveAttribute("href", "https://vikunja.example.com/tasks/42");
        expect(links[0]).toHaveAttribute("target", "_blank");
        expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
        expect(links[0]).toHaveTextContent("Do homework");

        expect(links[1]).toHaveAttribute("href", "https://vikunja.example.com/tasks/43");
        expect(links[1]).toHaveTextContent("Buy groceries");
    });

    it("uses widget.url when service.href is not provided", () => {
        useWidgetAPI.mockImplementation((_widget, endpoint) => {
            if (endpoint === "projects") return { data: [{ id: 1 }], error: undefined };
            if (endpoint === "tasks") {
                return {
                    data: [{ id: 99, title: "Deploy app", dueDateIsDefault: true, dueDate: "0001-01-01T00:00:00Z" }],
                    error: undefined,
                };
            }
            return { data: undefined, error: undefined };
        });

        const { container } = renderWithProviders(
            <Component
                service={{
                    widget: { type: "vikunja", enableTaskList: true, url: "http://vikunja-instance:3456" },
                }}
            />,
            { settings: { hideErrors: false } }
        );

        const link = container.querySelector("a[href]");
        expect(link).toHaveAttribute("href", "http://vikunja-instance:3456/tasks/99");
    });

    it("respects service.target and settings.target", () => {
        useWidgetAPI.mockImplementation((_widget, endpoint) => {
            if (endpoint === "projects") return { data: [{ id: 1 }], error: undefined };
            if (endpoint === "tasks") {
                return {
                    data: [{ id: 10, title: "Target test", dueDateIsDefault: true, dueDate: "0001-01-01T00:00:00Z" }],
                    error: undefined,
                };
            }
            return { data: undefined, error: undefined };
        });

        const { container } = renderWithProviders(
            <Component
                service={{
                    href: "https://vikunja.example.com",
                    target: "_self",
                    widget: { type: "vikunja", enableTaskList: true },
                }}
            />,
            { settings: { target: "_top" } }
        );

        const link = container.querySelector("a[href]");
        expect(link).toHaveAttribute("target", "_self");
    });

    it("renders task list items as non-clickable divs when no base URL is configured", () => {
        useWidgetAPI.mockImplementation((_widget, endpoint) => {
            if (endpoint === "projects") return { data: [{ id: 1 }], error: undefined };
            if (endpoint === "tasks") {
                return {
                    data: [{ id: 7, title: "No link task", dueDateIsDefault: true, dueDate: "0001-01-01T00:00:00Z" }],
                    error: undefined,
                };
            }
            return { data: undefined, error: undefined };
        });

        const { container } = renderWithProviders(
            <Component
                service={{
                    widget: { type: "vikunja", enableTaskList: true },
                }}
            />,
            { settings: { hideErrors: false } }
        );

        expect(container.querySelector("a[href]")).toBeNull();
        expect(screen.getByText("No link task")).toBeInTheDocument();
    });
});
