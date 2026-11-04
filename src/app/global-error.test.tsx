// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/global-error";

describe("app/global-error", () => {
    it("shows the error message and logs it", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            render(<GlobalError error={new Error("bad config")} retry={() => {}} />);

            expect(screen.getByText("Something went wrong")).toBeInTheDocument();
            expect(screen.getByText("bad config")).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "bad config" }));
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it("shows the digest when the error carries one", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        render(<GlobalError error={{ digest: "abc123" }} retry={() => {}} />);

        expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
    });

    it("calls retry when the button is clicked", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const retry = vi.fn();

        render(<GlobalError error={new Error("bad config")} retry={retry} />);
        fireEvent.click(screen.getByText("Try again"));

        expect(retry).toHaveBeenCalledOnce();
    });

    it("shows the stack in a collapsed details section", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const error = new RangeError("Invalid time value");
        error.stack = "RangeError: Invalid time value\n    at RootLayout (layout.tsx:40)";

        const { container } = render(<GlobalError error={error} retry={() => {}} />);

        const details = container.querySelector("details");
        expect(details).not.toBeNull();
        expect(details).not.toHaveAttribute("open");
        expect(screen.getByText("Error details").tagName).toBe("SUMMARY");
        expect(details?.querySelector("pre")).toHaveTextContent("at RootLayout (layout.tsx:40)");
    });

    it("shows a thrown non-Error value in the details section", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        const { container } = render(<GlobalError error="unknown failure" retry={() => {}} />);

        expect(container.querySelector("details pre")).toHaveTextContent("unknown failure");
    });
});
