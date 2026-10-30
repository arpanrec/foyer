import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type SearchOptions = InfoWidgetBaseOptions & {
    provider?: string | string[];
    showSearchSuggestions?: boolean;
    // a custom provider passes its URLs through the options
    suggestionUrl?: string;
    focus?: boolean;
};

// [the query, the suggestions for it]
export type SearchSuggestions = [string, string[]];
