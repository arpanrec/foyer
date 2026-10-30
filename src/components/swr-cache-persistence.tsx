import { useEffect } from "react";
import { useSWRConfig } from "swr";

import { readPersistedCache, writePersistedCache } from "@/utils/swr-cache";

// Restores widget data saved by the previous visit and saves it again when the page is hidden.
// Entries are restored after mount so the first client render matches the server render.
export default function SwrCachePersistence() {
    const { cache, mutate } = useSWRConfig();

    useEffect(() => {
        let storage: Storage;
        try {
            storage = window.localStorage;
        } catch {
            return undefined;
        }

        for (const [key, data] of readPersistedCache(storage)) {
            if (cache.get(key)?.data === undefined) {
                void mutate(key, data, { revalidate: false });
            }
        }

        const save = () => writePersistedCache(storage, cache);
        window.addEventListener("pagehide", save);
        return () => window.removeEventListener("pagehide", save);
    }, [cache, mutate]);

    return null;
}
