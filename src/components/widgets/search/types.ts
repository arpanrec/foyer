import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type SearchOptions = InfoWidgetBaseOptions & {
    provider?: string | string[] | undefined;
    showSearchSuggestions?: boolean | undefined;
    // a custom provider passes its URLs through the options
    suggestionUrl?: string | undefined;
    focus?: boolean | undefined;
};

// [the query, the suggestions for it]
export type SearchSuggestions = [string, string[]];
