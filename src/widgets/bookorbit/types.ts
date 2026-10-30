export type BookorbitTokens = {
    accessToken?: string;
    refreshToken?: string;
};

export type BookorbitLibrarySummary = {
    totalBooks?: number;
    totalAuthors?: number;
    totalSeries?: number;
    totalStorageBytes?: number;
};

export type BookorbitReadingSummary = {
    inProgressBooks?: number;
    completedBooks?: number;
};

export type BookorbitSummary = {
    books?: number;
    authors?: number;
    series?: number;
    storage?: number;
    reading?: number;
    finished?: number;
};
