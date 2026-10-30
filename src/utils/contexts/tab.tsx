import { createContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type TabContextValue = {
    activeTab: string | false;
    setActiveTab: Dispatch<SetStateAction<string | false>>;
};

export const TabContext = createContext<TabContextValue>({ activeTab: false, setActiveTab: () => {} });

export function TabProvider({ initialTab, children }: { initialTab?: string; children?: ReactNode }) {
    const [activeTab, setActiveTab] = useState<string | false>(() => initialTab ?? false);

    const value = useMemo(() => ({ activeTab, setActiveTab }), [activeTab]);

    return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
