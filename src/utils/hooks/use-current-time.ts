import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
type Store = {
    getSnapshot: () => number | null;
    subscribe: (onStoreChange: () => void) => () => void;
};

const stores = new Map<number, Store>();

function getStore(refreshInterval: number): Store {
    const existing = stores.get(refreshInterval);
    if (existing) return existing;

    const listeners = new Set<() => void>();
    let now: number | null = null; // null until mounted, so SSR and hydration render the same thing
    let timer: ReturnType<typeof setInterval> | null = null;

    const store: Store = {
        getSnapshot: () => now,
        subscribe: (onStoreChange) => {
            listeners.add(onStoreChange);

            if (!timer) {
                now = Date.now();
                timer = setInterval(() => {
                    now = Date.now();
                    listeners.forEach((listener) => listener());
                }, refreshInterval);
            }

            return () => {
                listeners.delete(onStoreChange);
                if (!listeners.size) {
                    clearInterval(timer ?? undefined);
                    timer = null;
                }
            };
        },
    };

    stores.set(refreshInterval, store);
    return store;
}

// Returns null on the server and during hydration, then the current time.
export default function useCurrentTime(refreshInterval = MINUTE) {
    const { subscribe, getSnapshot } = getStore(refreshInterval);
    return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
