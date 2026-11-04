// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WidgetVisibilityContext } from "@/utils/contexts/widget-visibility";
import WhenSized from "@/widgets/glances/components/when-sized";

describe("widgets/glances/components/when-sized", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders children when ResizeObserver is unavailable", () => {
        vi.stubGlobal("ResizeObserver", undefined);
        render(<WhenSized>child</WhenSized>);
        expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("renders children once the wrapper has a size and keeps them", () => {
        let notify: (width: number, height: number) => void = () => {};
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(callback: ResizeObserverCallback) {
                    notify = (width, height) =>
                        callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as never);
                }
                observe() {}
                disconnect() {}
            }
        );

        render(<WhenSized>child</WhenSized>);
        expect(screen.queryByText("child")).not.toBeInTheDocument();

        act(() => notify(0, 0));
        expect(screen.queryByText("child")).not.toBeInTheDocument();

        act(() => notify(100, 40));
        expect(screen.getByText("child")).toBeInTheDocument();

        act(() => notify(100, 0));
        expect(screen.getByText("child")).toBeInTheDocument();
    });

    it("does not render children while the group is hidden", () => {
        vi.stubGlobal("ResizeObserver", undefined);
        render(
            <WidgetVisibilityContext.Provider value={false}>
                <WhenSized>child</WhenSized>
            </WidgetVisibilityContext.Provider>
        );
        expect(screen.queryByText("child")).not.toBeInTheDocument();
    });

    it("assumes ResizeObserver support when rendered on the server", () => {
        expect(renderToString(<WhenSized>child</WhenSized>)).not.toContain("child");
    });

    it("ignores an observer callback without entries", () => {
        let notify: () => void = () => {};
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(callback: ResizeObserverCallback) {
                    notify = () => callback([], this as never);
                }
                observe() {}
                disconnect() {}
            }
        );

        render(<WhenSized>child</WhenSized>);
        act(() => notify());
        expect(screen.queryByText("child")).not.toBeInTheDocument();
    });
});
