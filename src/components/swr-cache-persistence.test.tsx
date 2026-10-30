// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import { beforeEach, describe, expect, it } from "vitest";

import SwrCachePersistence from "@/components/swr-cache-persistence";
import { writePersistedCache } from "@/utils/swr-cache";

const key = "/api/services/proxy?x=1";

function Probe() {
    const { data } = useSWR<{ count: number }>(key, () => new Promise<{ count: number }>(() => {}));
    return <div>{data ? `count:${data.count}` : "empty"}</div>;
}

describe("components/swr-cache-persistence", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("restores saved widget data without waiting for the network", async () => {
        writePersistedCache(window.localStorage, { keys: () => [key], get: () => ({ data: { count: 7 } }) });

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <SwrCachePersistence />
                <Probe />
            </SWRConfig>
        );

        expect(await screen.findByText("count:7")).toBeInTheDocument();
    });

    it("saves cached widget data when the page is hidden", async () => {
        const cache = new Map();
        render(
            <SWRConfig value={{ provider: () => cache }}>
                <SwrCachePersistence />
            </SWRConfig>
        );
        cache.set(key, { data: { count: 2 } });

        window.dispatchEvent(new Event("pagehide"));

        expect(window.localStorage.length).toBe(1);
        expect(window.localStorage.getItem(window.localStorage.key(0) as string)).toContain('"count":2');
    });
});
