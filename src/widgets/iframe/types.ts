import type { HTMLAttributeReferrerPolicy } from "react";

export type IframeOptions = {
    src?: string | undefined;
    name?: string | undefined;
    classes?: string | undefined;
    allowPolicy?: string | undefined;
    allowfullscreen?: boolean | undefined;
    allowFullscreen?: boolean | undefined;
    referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
    loadingStrategy?: "eager" | "lazy" | undefined;
    allowScrolling?: string | undefined;
    refreshInterval?: number | undefined;
};
