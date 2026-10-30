// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "@/app/error";

describe("app/error", () => {
    it("shows the error message and logs it", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            render(<ErrorBoundary error={new Error("bad config")} retry={() => {}} />);

            expect(screen.getByText("errorBoundary.title")).toBeInTheDocument();
            expect(screen.getByText("bad config")).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "bad config" }));
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it("shows the digest when the error carries one", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        render(<ErrorBoundary error={{ digest: "abc123" }} retry={() => {}} />);

        expect(screen.getByText("errorBoundary.digest")).toBeInTheDocument();
    });

    it("omits the message and digest paragraphs when the error carries neither", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        render(<ErrorBoundary error="unknown failure" retry={() => {}} />);

        expect(screen.queryByText("errorBoundary.digest")).toBeNull();
    });

    it("calls retry when the button is clicked", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const retry = vi.fn();

        render(<ErrorBoundary error={new Error("bad config")} retry={retry} />);
        fireEvent.click(screen.getByText("errorBoundary.retry"));

        expect(retry).toHaveBeenCalledOnce();
    });
});
