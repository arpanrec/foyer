export type HomeboxLoginReply = {
    token: string;
    expiresAt: string;
};

export type HomeboxGroupStatistics = {
    totalItems?: number;
    totalLocations?: number;
    totalLabels?: number;
    totalWithWarranty?: number;
    totalItemPrice?: number;
    totalUsers?: number;
};

export type HomeboxGroupData = {
    currency?: string;
};

export type HomeboxData = {
    items?: number;
    locations?: number;
    labels?: number;
    totalWithWarranty?: number;
    totalValue?: number;
    users?: number;
    currencyCode?: string;
};
