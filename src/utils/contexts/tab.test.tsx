// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it } from "vitest";

import { TabContext, TabProvider } from "@/utils/contexts/tab";

function Reader() {
    const { activeTab, setActiveTab, isPending } = useContext(TabContext);
    return (
        <div>
            <div data-testid="value">{String(activeTab)}</div>
            <div data-testid="pending">{String(isPending)}</div>
            <button type="button" onClick={() => setActiveTab("next")}>
                next
            </button>
            <button type="button" onClick={() => setActiveTab((current) => (current === "first" ? "second" : "other"))}>
                update
            </button>
        </div>
    );
}

describe("utils/contexts/tab", () => {
    it("provides initial tab and allows updates", () => {
        render(
            <TabProvider initialTab="first">
                <Reader />
            </TabProvider>
        );

        expect(screen.getByTestId("value")).toHaveTextContent("first");
        fireEvent.click(screen.getByRole("button", { name: "next" }));
        expect(screen.getByTestId("value")).toHaveTextContent("next");
        expect(screen.getByTestId("pending")).toHaveTextContent("false");
    });

    it("applies the first tab immediately and later switches as transitions", () => {
        render(
            <TabProvider>
                <Reader />
            </TabProvider>
        );

        expect(screen.getByTestId("value")).toHaveTextContent("false");
        fireEvent.click(screen.getByRole("button", { name: "next" }));
        expect(screen.getByTestId("value")).toHaveTextContent("next");
        expect(screen.getByTestId("pending")).toHaveTextContent("false");
    });

    it("passes the current tab to an updater function", () => {
        render(
            <TabProvider initialTab="first">
                <Reader />
            </TabProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: "update" }));
        expect(screen.getByTestId("value")).toHaveTextContent("second");
        fireEvent.click(screen.getByRole("button", { name: "update" }));
        expect(screen.getByTestId("value")).toHaveTextContent("other");
    });
});
