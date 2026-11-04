"use client";

import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Spinner } from "@/components/loading";

type LazyPanelProps = {
    open: boolean;
    children: ReactNode;
};

/**
 * Renders its children from the first time `open` is true and keeps them mounted afterwards. A group that
 * starts collapsed shows a spinner until then, so its widgets do not load for content nobody has seen.
 * Anything inside that suspends shows the same spinner within the panel. The state is set while rendering, so the children mount in the same pass that opens the panel and
 * the height transition measures the real content.
 */
export default function LazyPanel({ open, children }: LazyPanelProps) {
    const [hasOpened, setHasOpened] = useState(open);
    if (open && !hasOpened) setHasOpened(true);

    const fallback = (
        <div className="flex justify-center p-4">
            <Spinner />
        </div>
    );

    if (!hasOpened) return fallback;

    // Widgets load their code on demand and suspend while it arrives. This boundary keeps that wait inside the
    // section instead of letting it reach the one around the whole dashboard, which would blank every group.
    return <Suspense fallback={fallback}>{children}</Suspense>;
}
