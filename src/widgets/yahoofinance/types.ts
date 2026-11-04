export type MarketConfig = {
    symbol: string;
    name?: string | undefined;
};

export type MarketsOptions = {
    markets?: MarketConfig[];
    sortBy?: "change" | "absolute-change";
    cache?: number;
};

export type Market = {
    symbol: string;
    name: string;
    currency: string | null;
    price: number | null;
    percentChange: number | null;
};

export type MarketsData = {
    error?: unknown;
    markets: Market[];
};
