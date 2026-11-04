// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DarkReaderBanner from "@/components/dark-reader-banner";

const { useDarkReader } = vi.hoisted(() => ({ useDarkReader: vi.fn() }));
vi.mock("@/utils/hooks/dark-reader", () => ({ default: useDarkReader }));

describe("components/dark-reader-banner", () => {
    beforeEach(() => {
        useDarkReader.mockReturnValue(true);
    });

    it("renders nothing without Dark Reader", () => {
        useDarkReader.mockReturnValue(false);
        render(<DarkReaderBanner />);
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows the warning and can be dismissed", () => {
        render(<DarkReaderBanner />);
        expect(screen.getByText("darkReader.warning")).toBeInTheDocument();
        fireEvent.click(screen.getByText("darkReader.dismiss"));
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
