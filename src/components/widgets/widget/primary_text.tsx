import type { ReactNode } from "react";
export default function PrimaryText({ children }: { children: ReactNode }) {
    return <span className="primary-text text-theme-800 dark:text-theme-200 text-sm">{children}</span>;
}
