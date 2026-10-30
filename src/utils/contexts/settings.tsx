import { createContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import type { Settings } from "@/types/service";

type SettingsContextValue = {
    settings: Settings;
    setSettings: Dispatch<SetStateAction<Settings>>;
};

export const SettingsContext = createContext<SettingsContextValue>({ settings: {}, setSettings: () => {} });

export function SettingsProvider({ initialSettings, children }: { initialSettings?: Settings; children?: ReactNode }) {
    const [settings, setSettings] = useState(() => initialSettings ?? {});

    const value = useMemo(() => ({ settings, setSettings }), [settings]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
