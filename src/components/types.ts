// How the settings config lays out one group: `layout.<group name>`
export type GroupLayout = {
    tab?: string | undefined;
    style?: string | undefined;
    columns?: number | undefined;
    header?: boolean | undefined;
    icon?: string | undefined;
    initiallyCollapsed?: boolean | undefined;
    iconsOnly?: boolean | undefined;
    useEqualHeights?: boolean | undefined;
    // a services group also nests the layouts of its subgroups
    [subgroup: string]: unknown;
};

// An entry of `/api/bookmarks`
export type Bookmark = {
    name: string;
    href: string;
    description?: string;
    icon?: string;
    abbr?: string;
    target?: string;
    id?: string;
};

export type BookmarkGroup = {
    name: string;
    bookmarks: Bookmark[];
};

// The part of the settings `quicklaunch` that the quick launch dialog reads
export type QuicklaunchSettings = {
    searchDescriptions?: boolean;
    hideVisitURL?: boolean;
    provider?: string;
    name?: string;
    url?: string;
    suggestionUrl?: string;
    target?: string;
    showSearchSuggestions?: boolean;
    mobileButtonPosition?: string;
};
