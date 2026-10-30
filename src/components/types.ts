// How settings.yaml lays out one group: `layout.<group name>`
export type GroupLayout = {
    tab?: string;
    style?: string;
    columns?: number;
    header?: boolean;
    icon?: string;
    initiallyCollapsed?: boolean;
    iconsOnly?: boolean;
    useEqualHeights?: boolean;
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

// The part of settings.yaml's `quicklaunch` that the quick launch dialog reads
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
