// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import LazyPanel from "@/components/lazy-panel";

vi.mock("next-i18next/pages", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const never = new Promise<never>(() => {});

function Suspending(): never {
    throw never;
}

describe("components/lazy-panel", () => {
    it("shows a spinner and no children while the panel has never been open", () => {
        render(
            <LazyPanel open={false}>
                <div>content</div>
            </LazyPanel>
        );
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.queryByText("content")).not.toBeInTheDocument();
    });

    it("renders the children once open and keeps them after closing", () => {
        const { rerender } = render(
            <LazyPanel open={false}>
                <div>content</div>
            </LazyPanel>
        );
        rerender(
            <LazyPanel open>
                <div>content</div>
            </LazyPanel>
        );
        expect(screen.getByText("content")).toBeInTheDocument();
        rerender(
            <LazyPanel open={false}>
                <div>content</div>
            </LazyPanel>
        );
        expect(screen.getByText("content")).toBeInTheDocument();
    });

    it("keeps a suspending child inside the panel instead of the outer boundary", () => {
        render(
            <div>
                <p>outside</p>
                <Suspense fallback={<div>page fallback</div>}>
                    <LazyPanel open>
                        <Suspending />
                    </LazyPanel>
                </Suspense>
            </div>
        );
        expect(screen.getByText("outside")).toBeInTheDocument();
        expect(screen.queryByText("page fallback")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
});
