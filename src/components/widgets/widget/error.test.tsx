// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Error from "@/components/widgets/widget/error";
import { renderWithProviders } from "@/test-utils/render-with-providers";

describe("components/widgets/widget/error", () => {
    it("renders the api_error message", () => {
        renderWithProviders(<Error options={{}} />, { settings: { target: "_self" } });
        expect(screen.getByText("widget.api_error")).toBeInTheDocument();
    });
});
