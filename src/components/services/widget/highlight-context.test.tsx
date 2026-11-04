// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it } from "vitest";

import { BlockHighlightContext } from "@/components/services/widget/highlight-context";

function Reader() {
    const value = useContext(BlockHighlightContext);
    return <div data-testid="value">{value === null ? "null" : JSON.stringify(value)}</div>;
}

describe("components/services/widget/highlight-context", () => {
    it("defaults to null", () => {
        render(<Reader />);
        expect(screen.getByTestId("value")).toHaveTextContent("null");
    });

    it("provides a value to consumers", () => {
        render(
            <BlockHighlightContext.Provider value={{ levels: { good: "on" }, fields: {} }}>
                <Reader />
            </BlockHighlightContext.Provider>
        );
        expect(screen.getByTestId("value")).toHaveTextContent('"on"');
    });
});
