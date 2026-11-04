// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import useSWR from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pauseWhenHidden, WidgetVisibilityContext } from "@/utils/contexts/widget-visibility";

const fetcher = vi.fn(async () => "payload");

function Reader() {
    const { data } = useSWR("key", fetcher);
    return <div data-testid="data">{data ?? "empty"}</div>;
}

function Harness({ visible, children }: { visible?: boolean; children: ReactNode }) {
    const inner =
        visible === undefined ? (
            children
        ) : (
            <WidgetVisibilityContext.Provider value={visible}>{children}</WidgetVisibilityContext.Provider>
        );
    return (
        <SWRConfig
            value={{ provider: () => new Map(), use: [pauseWhenHidden], dedupingInterval: 0, refreshInterval: 1000 }}
        >
            {inner}
        </SWRConfig>
    );
}

async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe("utils/contexts/widget-visibility", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        fetcher.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("fetches when there is no provider", async () => {
        render(
            <Harness>
                <Reader />
            </Harness>
        );
        await flush(50);

        expect(fetcher).toHaveBeenCalled();
        expect(screen.getByTestId("data")).toHaveTextContent("payload");
    });

    it("never fetches while hidden", async () => {
        render(
            <Harness visible={false}>
                <Reader />
            </Harness>
        );
        await flush(5000);

        expect(fetcher).not.toHaveBeenCalled();
        expect(screen.getByTestId("data")).toHaveTextContent("empty");
    });

    it("fetches once it becomes visible", async () => {
        const { rerender } = render(
            <Harness visible={false}>
                <Reader />
            </Harness>
        );
        await flush(2000);
        expect(fetcher).not.toHaveBeenCalled();

        rerender(
            <Harness visible>
                <Reader />
            </Harness>
        );
        await flush(50);

        expect(fetcher).toHaveBeenCalled();
        expect(screen.getByTestId("data")).toHaveTextContent("payload");
    });

    it("keeps data and stops polling when hidden, then resumes", async () => {
        const { rerender } = render(
            <Harness visible>
                <Reader />
            </Harness>
        );
        await flush(50);
        expect(screen.getByTestId("data")).toHaveTextContent("payload");

        rerender(
            <Harness visible={false}>
                <Reader />
            </Harness>
        );
        await flush(50);
        fetcher.mockClear();
        await flush(5000);

        expect(fetcher).not.toHaveBeenCalled();
        expect(screen.getByTestId("data")).toHaveTextContent("payload");

        rerender(
            <Harness visible>
                <Reader />
            </Harness>
        );
        await flush(100);

        expect(fetcher).toHaveBeenCalled();
    });
});
