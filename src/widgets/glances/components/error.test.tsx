// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Error from "@/widgets/glances/components/error";

describe("widgets/glances/components/error", () => {
    it("renders the standard widget api error message", () => {
        render(<Error />);
        expect(screen.getByText("widget.api_error")).toBeInTheDocument();
    });
});
