// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/utils/api-fetch", () => ({ default: apiFetch }));
vi.mock("next-i18next/pages", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import Reload from "@/components/toggles/reload";

describe("components/toggles/reload", () => {
    const reloadPage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, "location", { configurable: true, value: { reload: reloadPage } });
    });

    it("posts to the reload endpoint and reloads the page on success", async () => {
        apiFetch.mockResolvedValueOnce({ reloaded: true });
        render(<Reload />);

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
        expect(apiFetch).toHaveBeenCalledWith("/api/reload", { method: "POST" });
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("still reloads the page when browser storage is blocked", async () => {
        apiFetch.mockResolvedValueOnce({ reloaded: true });
        vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
            throw new Error("blocked");
        });
        render(<Reload />);

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
        vi.restoreAllMocks();
    });

    it("shows the reason in a popup when the config is broken, and closes it", async () => {
        apiFetch.mockResolvedValueOnce({ reloaded: false, error: "Unexpected token" });
        render(<Reload />);

        fireEvent.click(screen.getByRole("button"));

        expect(await screen.findByRole("alertdialog")).toHaveTextContent("Unexpected token");
        expect(screen.getByText("reload.brokenTitle")).toBeInTheDocument();
        expect(reloadPage).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("reload.close"));
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("falls back to a generic message when no reason comes back", async () => {
        apiFetch.mockResolvedValueOnce({ reloaded: false });
        render(<Reload />);
        fireEvent.click(screen.getByRole("button"));

        expect(await screen.findByRole("alertdialog")).toHaveTextContent("reload.failed");
    });

    it("shows the generic message when the request fails", async () => {
        apiFetch.mockRejectedValueOnce(new Error("network"));
        render(<Reload />);
        fireEvent.click(screen.getByRole("button"));

        expect(await screen.findByRole("alertdialog")).toHaveTextContent("reload.failed");
        expect(screen.getByRole("button", { name: "reload.reload" })).not.toBeDisabled();
    });
});
