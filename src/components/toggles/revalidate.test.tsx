// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Revalidate from "@/components/toggles/revalidate";

describe("components/toggles/revalidate", () => {
    it("shows a tooltip describing the action", () => {
        render(<Revalidate />);
        expect(document.getElementById("revalidate")).toHaveAttribute("title", "Reload configuration");
    });

    it("calls /api/revalidate and reloads when ok", async () => {
        const reload = vi.fn();
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true } as Response);
        vi.stubGlobal("location", { reload });

        render(<Revalidate />);
        const icon = document.querySelector("svg");
        fireEvent.click(icon!);

        // allow promise chain to flush
        await Promise.resolve();

        expect(fetchSpy).toHaveBeenCalledWith("/api/revalidate");
        expect(reload).toHaveBeenCalledTimes(1);

        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
    });
});
