export type GhostfolioPerformance = {
    statusCode?: number;
    performance: {
        netPerformancePercentageWithCurrencyEffect?: number;
        grossPerformancePercentage?: number;
        currentGrossPerformancePercent: number;
        currentNetWorth: number;
    };
};

export type GhostfolioUserInfo = {
    settings?: {
        baseCurrency?: string;
        currency?: string;
    };
};
