import { type RefObject, useEffect, useState } from "react";

// Reports whether the element is inside the viewport, extended by rootMargin so elements just off-screen are
// already loaded when they scroll in. Without IntersectionObserver the element always counts as in the viewport.
export default function useInViewport(ref: RefObject<Element | null>, rootMargin = "300px 0px") {
    const supported = typeof IntersectionObserver !== "undefined";
    const [inViewport, setInViewport] = useState(!supported);

    useEffect(() => {
        const element = ref.current;
        if (!supported || !element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const latest = entries.at(-1);
                if (latest) setInViewport(latest.isIntersecting);
            },
            { rootMargin }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, rootMargin, supported]);

    return inViewport;
}
