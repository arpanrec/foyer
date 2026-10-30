import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type ColorContextValue = {
    color: string;
    setColor: Dispatch<SetStateAction<string>>;
};

let lastColor: string | false = false;

const getInitialColor = () => {
    if (typeof window !== "undefined" && window.localStorage) {
        const storedPrefs = window.localStorage.getItem("theme-color");
        if (typeof storedPrefs === "string") {
            lastColor = storedPrefs;
            return storedPrefs;
        }
    }

    return "slate"; // slate as the default color;
};

export const ColorContext = createContext<ColorContextValue>({ color: "slate", setColor: () => {} });

export function ColorProvider({ initialTheme, children }: { initialTheme?: string; children?: ReactNode }) {
    const [color, setColor] = useState(() => initialTheme ?? getInitialColor());

    const rawSetColor = (rawColor: string) => {
        const root = window.document.documentElement;

        root.classList.remove(`theme-${lastColor}`);
        root.classList.add(`theme-${rawColor}`);

        localStorage.setItem("theme-color", rawColor);

        lastColor = rawColor;
    };

    useEffect(() => {
        rawSetColor(color);
    }, [color]);

    const value = useMemo(() => ({ color, setColor }), [color]);

    return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
}
