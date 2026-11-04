import {
    createContext,
    useCallback,
    useMemo,
    useRef,
    useState,
    useTransition,
    type ReactNode,
    type SetStateAction,
} from "react";

type TabContextValue = {
    activeTab: string | false;
    setActiveTab: (value: SetStateAction<string | false>) => void;
    isPending: boolean;
};

export const TabContext = createContext<TabContextValue>({
    activeTab: false,
    setActiveTab: () => {},
    isPending: false,
});

export function TabProvider({ initialTab, children }: { initialTab?: string; children?: ReactNode }) {
    const [activeTab, setActiveTabState] = useState<string | false>(() => initialTab ?? false);
    const [isPending, startTransition] = useTransition();

    const currentTab = useRef(activeTab);

    // Setting the first tab is urgent: the dashboard waits for it. Only a switch away from a
    // tab that is already showing runs as a transition, so the old content stays up with a pending flag.
    const setActiveTab = useCallback((value: SetStateAction<string | false>) => {
        const wasShowing = currentTab.current;
        currentTab.current = typeof value === "function" ? value(currentTab.current) : value;
        if (!wasShowing) {
            setActiveTabState(value);
            return;
        }
        startTransition(() => {
            setActiveTabState(value);
        });
    }, []);

    const value = useMemo(() => ({ activeTab, setActiveTab, isPending }), [activeTab, setActiveTab, isPending]);

    return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
