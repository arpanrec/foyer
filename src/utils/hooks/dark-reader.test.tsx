// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import useDarkReader from "@/utils/hooks/dark-reader";

describe("utils/hooks/dark-reader", () => {
    afterEach(() => {
        document.documentElement.removeAttribute("data-darkreader-mode");
        document.head.querySelector('meta[name="darkreader"]')?.remove();
    });

    it("is false without Dark Reader", () => {
        const { result } = renderHook(() => useDarkReader());
        expect(result.current).toBe(false);
    });

    it("detects the html attribute added later", async () => {
        const { result } = renderHook(() => useDarkReader());
        await act(async () => {
            document.documentElement.setAttribute("data-darkreader-mode", "dynamic");
            await Promise.resolve();
        });
        expect(result.current).toBe(true);
    });

    it("detects the meta tag", async () => {
        const { result } = renderHook(() => useDarkReader());
        await act(async () => {
            const meta = document.createElement("meta");
            meta.name = "darkreader";
            document.head.appendChild(meta);
            await Promise.resolve();
        });
        expect(result.current).toBe(true);
    });
});
