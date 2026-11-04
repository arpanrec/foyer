// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "@/app/loading";

describe("app/loading", () => {
    it("renders the loading screen", () => {
        render(<Loading />);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
});
