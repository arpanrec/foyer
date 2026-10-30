// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Greeting from "@/components/widgets/greeting/greeting";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("components/widgets/greeting", () => {
    it("renders nothing when text is not configured", () => {
        const { container } = renderWithProviders(<Greeting options={{}} />, { settings: { target: "_self" } });
        expect(container).toBeEmptyDOMElement();
    });

    it("renders configured greeting text", () => {
        renderWithProviders(<Greeting options={{ text: "Hello there" }} />, { settings: { target: "_self" } });
        expect(screen.getByText("Hello there")).toBeInTheDocument();
    });
});
