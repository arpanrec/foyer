import type { ReactNode } from "react";
export default function SecondaryText({ children }: { children: ReactNode }) {
    return <span className="secondary-text text-theme-800 dark:text-theme-200 text-xs">{children}</span>;
}
