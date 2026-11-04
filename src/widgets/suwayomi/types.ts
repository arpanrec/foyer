export type SuwayomiOptions = {
    category?: string | number;
};

export type SuwayomiChapter = {
    isRead: boolean;
    isDownloaded: boolean;
};

export type SuwayomiCountsData = Record<string, { totalCount: number }>;

export type SuwayomiCategoryData = {
    category: {
        mangas: {
            nodes: { chapters: { nodes: SuwayomiChapter[] } }[];
        };
    };
};

export type SuwayomiResponse = {
    data: SuwayomiCountsData | SuwayomiCategoryData;
};

export type SuwayomiCount = {
    count: number;
    label: string;
};
