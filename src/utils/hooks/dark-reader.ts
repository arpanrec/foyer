import { useSyncExternalStore } from "react";

// Dark Reader marks the page with a <meta name="darkreader"> tag and data-darkreader-* attributes on <html>.
const isDarkReaderActive = () => {
    if (typeof document === "undefined") return false;
    const html = document.documentElement;
    return (
        Boolean(document.querySelector('meta[name="darkreader"]')) ||
        html.hasAttribute("data-darkreader-mode") ||
        html.hasAttribute("data-darkreader-scheme")
    );
};

const subscribe = (onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, childList: true });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
};

const useDarkReader = () => useSyncExternalStore(subscribe, isDarkReaderActive, () => false);

export default useDarkReader;
