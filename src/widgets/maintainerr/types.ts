export type MaintainerrData = {
    cleanupTotals?: {
        itemsHandled?: number;
        episodesHandled?: number;
        moviesHandled?: number;
        showsHandled?: number;
        seasonsHandled?: number;
    };
    collectionSummary?: {
        activeSizeBytes?: number;
        movieSizeBytes?: number;
        showSizeBytes?: number;
    };
    totals?: { totalSpace?: number };
};
