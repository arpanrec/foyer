import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

const useHydrated = () =>
    useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false
    );

export default useHydrated;
