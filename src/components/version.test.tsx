// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Version from "@/components/version";

describe("components/version", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_VERSION = "dev";
        process.env.NEXT_PUBLIC_REVISION = "abcdef012345";
        process.env.NEXT_PUBLIC_BUILDTIME = "2020-01-01T00:00:00.000Z";
    });

    it("renders non-link version text for dev/main/nightly", () => {
        render(<Version />);

        expect(screen.getByText(/dev \(abcdef0/)).toBeInTheDocument();
        expect(screen.queryAllByRole("link")).toHaveLength(0);
    });

    it("renders a tag link for release versions", () => {
        process.env.NEXT_PUBLIC_VERSION = "1.2.3";

        render(<Version />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(1);
        expect(links[0]!.getAttribute("href")).toContain("/releases/tag/1.2.3");
    });

    it("falls back build time to the current date when NEXT_PUBLIC_BUILDTIME is missing", () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2021-01-02T12:00:00.000Z"));
            process.env.NEXT_PUBLIC_BUILDTIME = "";

            render(<Version />);

            expect(screen.getByText(/2021/)).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it.each(["dev", "not-a-date"])("shows an unparsable NEXT_PUBLIC_BUILDTIME %j as written", (value) => {
        process.env.NEXT_PUBLIC_BUILDTIME = value;

        render(<Version />);

        expect(screen.getByText(`dev (abcdef0, ${value})`)).toBeInTheDocument();
    });

    it("shows an unparsable NEXT_PUBLIC_BUILDTIME as written on the release link", () => {
        process.env.NEXT_PUBLIC_VERSION = "1.2.3";
        process.env.NEXT_PUBLIC_BUILDTIME = "dev";

        render(<Version />);

        expect(screen.getByRole("link")).toHaveTextContent("1.2.3 (abcdef0, dev)");
    });

    it.each([undefined, "   "])("falls back to the current date when NEXT_PUBLIC_BUILDTIME is %j", (value) => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date("2021-01-02T12:00:00.000Z"));
            if (value === undefined) {
                delete process.env.NEXT_PUBLIC_BUILDTIME;
            } else {
                process.env.NEXT_PUBLIC_BUILDTIME = value;
            }

            render(<Version />);

            expect(screen.getByText(/2021/)).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
