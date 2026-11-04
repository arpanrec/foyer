export type StocksOptions = {
    watchlist?: string[];
    showUSMarketStatus?: boolean;
};

export type StocksStatus = {
    isOpen?: boolean;
};

export type StocksQuote = {
    dp?: number;
    c?: number;
};
