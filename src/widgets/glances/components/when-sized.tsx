import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { WidgetVisibilityContext } from "@/utils/contexts/widget-visibility";

type WhenSizedProps = {
    className?: string | undefined;
    children: ReactNode;
};

/**
 * Renders its children once the wrapper has a width and a height, and keeps them after that. A chart inside
 * a collapsed or still opening group would otherwise measure 0 x 0, which Recharts reports as a warning.
 * The children are dropped as soon as the group starts closing, before its height animates to 0.
 */
export default function WhenSized({ className, children }: WhenSizedProps) {
    const visible = useContext(WidgetVisibilityContext);
    const ref = useRef<HTMLDivElement>(null);
    const [sized, setSized] = useState(false);
    // The server assumes support, so server and first client render agree; an unsupported browser re-renders
    const supported = useSyncExternalStore(
        () => () => {},
        () => typeof ResizeObserver !== "undefined",
        () => true
    );

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === "undefined") return undefined;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry?.contentRect ?? { width: 0, height: 0 };
            if (width > 0 && height > 0) {
                setSized(true);
                observer.disconnect();
            }
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className={className}>
            {visible && (sized || !supported) ? children : null}
        </div>
    );
}
