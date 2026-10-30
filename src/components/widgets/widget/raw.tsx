import { isValidElement, type ReactNode } from "react";

export default function Raw({ children }: { children: ReactNode }) {
    if (isValidElement(children) && children.type === Raw) {
        return [children];
    }

    return children;
}
