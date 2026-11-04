export type CoinmarketcapOptions = {
    symbols?: string[];
    slugs?: string[];
    currency?: string;
    defaultinterval?: string;
};

export type CoinmarketcapCrypto = {
    id: number;
    name: string;
    // Per currency: `price` and the `percent_change_<range>` fields (null ones are filtered out)
    quote: Record<string, { price: number; [field: string]: number }>;
};

export type CoinmarketcapQuotes = {
    data: Record<string, CoinmarketcapCrypto>;
};
