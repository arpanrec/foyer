export type AudiobookshelfLibraryStats = {
    totalItems?: number | string;
    totalDuration?: number | string;
};

export type AudiobookshelfLibrary = {
    id: string;
    mediaType: string;
    stats?: AudiobookshelfLibraryStats;
};

export type AudiobookshelfLibraries = {
    libraries: Omit<AudiobookshelfLibrary, "stats">[];
};
