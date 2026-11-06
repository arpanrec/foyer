import { createContext, useContext } from "react";
import type { Middleware, SWRHook } from "swr";

// False below a collapsed service group or a card outside the viewport; every SWR hook in that subtree stops fetching
// and polling.
export const WidgetVisibilityContext = createContext(true);

// Passing a null key stops the first fetch and all polling. The cache keeps the data, and SWR
// revalidates when the key returns. keepPreviousData keeps the last data on screen while paused.
export const pauseWhenHidden: Middleware = (useSWRNext: SWRHook) =>
    function useSWRWhenVisible(key, fetcher, config) {
        const visible = useContext(WidgetVisibilityContext);
        return useSWRNext(visible ? key : null, fetcher, visible ? config : { ...config, keepPreviousData: true });
    };
