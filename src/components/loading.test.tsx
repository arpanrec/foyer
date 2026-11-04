// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingScreen, Spinner } from "@/components/loading";

describe("components/loading", () => {
    it("Spinner has the status role and a label key", () => {
        render(<Spinner />);
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "loading.label");
    });

    it("LoadingScreen renders a spinner", () => {
        render(<LoadingScreen />);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
});
