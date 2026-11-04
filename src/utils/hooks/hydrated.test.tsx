// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import useHydrated from "@/utils/hooks/hydrated";

function Probe() {
    return <span>{String(useHydrated())}</span>;
}

describe("utils/hooks/hydrated", () => {
    it("is true on the client", () => {
        const { result } = renderHook(() => useHydrated());
        expect(result.current).toBe(true);
    });

    it("is false in server rendering", () => {
        expect(renderToString(<Probe />)).toContain("false");
    });
});
