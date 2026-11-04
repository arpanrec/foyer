// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import type { ComponentPropsWithoutRef, ElementType, ForwardedRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@headlessui/react", async () => {
    const React = await import("react");
    const { Fragment } = React;
    const ToggleContext = React.createContext<() => void>(() => {});

    function Transition({ as: As = Fragment, children }: { as?: ElementType; children: ReactNode }) {
        if (As === Fragment) return <>{children}</>;
        return <As>{children}</As>;
    }

    function Disclosure({
        defaultOpen = true,
        children,
    }: {
        defaultOpen?: boolean;
        children: ReactNode | ((state: { open: boolean }) => ReactNode);
    }) {
        const [open, setOpen] = React.useState(defaultOpen);
        const content = typeof children === "function" ? children({ open }) : children;
        return (
            <ToggleContext.Provider value={() => setOpen((o) => !o)}>
                <div>{content}</div>
            </ToggleContext.Provider>
        );
    }

    function DisclosureButton(props: ComponentPropsWithoutRef<"button">) {
        const toggle = React.useContext(ToggleContext);
        return <button type="button" onClick={toggle} {...props} />;
    }

    const DisclosurePanel = React.forwardRef(function DisclosurePanel(
        { static: _static, ...props }: ComponentPropsWithoutRef<"div"> & { static?: boolean | string },
        ref: ForwardedRef<HTMLDivElement>
    ) {
        return <div ref={ref} data-testid="disclosure-panel" {...props} />;
    });

    return { Disclosure, DisclosureButton, DisclosurePanel, Transition };
});

vi.mock("@/components/resolvedicon", () => ({
    default: function ResolvedIconMock() {
        return <div data-testid="resolved-icon" />;
    },
}));

vi.mock("@/components/services/list", () => ({
    default: function ServicesListMock({ groupName, services }: { groupName: string; services?: unknown[] }) {
        const visible = useContext(WidgetVisibilityContext);
        return (
            <div data-testid="services-list-mock" data-visible={String(visible)}>
                {groupName}:{services?.length ?? 0}
            </div>
        );
    },
}));

import ServicesGroup from "@/components/services/group";
import { WidgetVisibilityContext } from "@/utils/contexts/widget-visibility";

describe("components/services/group", () => {
    it("renders group and subgroup headers", () => {
        render(
            <ServicesGroup
                group={{
                    name: "Main",
                    services: [{ name: "svc" }],
                    groups: [{ name: "Sub", services: [], groups: [] }],
                }}
                layout={{ icon: "mdi:test" }}
                groupsInitiallyCollapsed={false}
            />
        );

        expect(screen.getByText("Main")).toBeInTheDocument();
        expect(screen.getByTestId("resolved-icon")).toBeInTheDocument();
        const lists = screen.getAllByTestId("services-list-mock");
        expect(lists[0]).toHaveTextContent("Main:1");
        expect(screen.getByText("Sub")).toBeInTheDocument();
    });

    it("lays subgroups out in columns for a row layout", () => {
        const { container } = render(
            <ServicesGroup
                group={{
                    name: "Main",
                    services: [{ name: "svc" }],
                    groups: [{ name: "Sub", services: [], groups: [] }],
                }}
                layout={{ style: "row", columns: 3 }}
                groupsInitiallyCollapsed={false}
            />
        );

        expect(screen.getByText("Sub")).toBeInTheDocument();
        expect(container.querySelector(".gap-x-2")).not.toBeNull();
    });

    it("marks the list visible when the group is not collapsed", () => {
        render(<ServicesGroup group={{ name: "Main", services: [], groups: [] }} groupsInitiallyCollapsed={false} />);

        expect(screen.getByTestId("services-list-mock")).toHaveAttribute("data-visible", "true");
    });

    it("renders no list and shows a spinner when the group is initially collapsed", () => {
        render(
            <ServicesGroup
                group={{ name: "Main", services: [], groups: [] }}
                layout={{ initiallyCollapsed: true }}
                groupsInitiallyCollapsed={false}
            />
        );

        expect(screen.queryByTestId("services-list-mock")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("mounts the list on first open and keeps it after closing", async () => {
        render(
            <ServicesGroup
                group={{ name: "Main", services: [], groups: [] }}
                layout={{ initiallyCollapsed: true }}
                groupsInitiallyCollapsed={false}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: /Main/ }));
        expect(await screen.findByTestId("services-list-mock")).toHaveAttribute("data-visible", "true");

        fireEvent.click(screen.getByRole("button", { name: /Main/ }));
        expect(screen.getByTestId("services-list-mock")).toHaveAttribute("data-visible", "false");
    });

    it("renders neither the list nor its subgroups when the parent is collapsed", () => {
        render(
            <ServicesGroup
                group={{
                    name: "Main",
                    services: [],
                    groups: [{ name: "Sub", services: [], groups: [] }],
                }}
                layout={{ initiallyCollapsed: true, Sub: { initiallyCollapsed: false } }}
            />
        );

        expect(screen.queryAllByTestId("services-list-mock")).toHaveLength(0);
        expect(screen.queryByText("Sub")).not.toBeInTheDocument();
    });

    it("marks an open group hidden inside a hidden provider", () => {
        render(
            <WidgetVisibilityContext.Provider value={false}>
                <ServicesGroup group={{ name: "Main", services: [], groups: [] }} groupsInitiallyCollapsed={false} />
            </WidgetVisibilityContext.Provider>
        );

        expect(screen.getByTestId("services-list-mock")).toHaveAttribute("data-visible", "false");
    });

    it("sets the panel height to 0 when initially collapsed", async () => {
        render(
            <ServicesGroup
                group={{ name: "Main", services: [], groups: [] }}
                layout={{ initiallyCollapsed: true }}
                groupsInitiallyCollapsed={false}
            />
        );

        const panel = screen.getAllByTestId("disclosure-panel")[0];
        await waitFor(() => {
            expect(panel!.style.height).toBe("0px");
        });
    });
});
