import type { HTMLAttributeReferrerPolicy } from "react";

export type IframeOptions = {
    src?: string;
    name?: string;
    classes?: string;
    allowPolicy?: string;
    allowfullscreen?: boolean;
    allowFullscreen?: boolean;
    referrerPolicy?: HTMLAttributeReferrerPolicy;
    loadingStrategy?: "eager" | "lazy";
    allowScrolling?: string;
    refreshInterval?: number;
};
