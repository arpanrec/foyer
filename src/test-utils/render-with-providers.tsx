import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import type { Settings } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";

export function renderWithProviders(ui: ReactElement, { settings = {} }: { settings?: Settings } = {}) {
    const value = {
        settings,
        // Most tests don't need to mutate settings; this keeps Container happy.
        setSettings: () => {},
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
        <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
    );

    return render(ui, { wrapper });
}
