import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type StocksOptions = InfoWidgetBaseOptions & {
    color?: boolean;
};

export type Stock = {
    ticker: string;
    currentPrice: string | null;
    percentChange: number | null;
};

export type StocksData = {
    error?: unknown;
    stocks: (Stock | null)[];
};
