import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { Market, MarketsData, MarketsOptions } from "@/widgets/yahoofinance/types";

/**
 * Renders one market row with its name, price in the reported currency, and percent change.
 *
 * @param props The market to show.
 */
function MarketItem({ market }: { market: Market }) {
    const { t } = useTranslation();
    const { percentChange, price } = market;
    // The default two fraction digits round a price below half a cent to zero
    const precision = price !== null && price < 1 ? { maximumFractionDigits: 8 } : {};

    return (
        <div className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm flex flex-1 items-center justify-between m-1 p-1 text-xs">
            <span className="font-thin ml-2 truncate" title={market.symbol}>
                {market.name || market.symbol}
            </span>
            <div className="flex items-center flex-row-reverse mr-2 text-right">
                <span
                    className={`font-bold ml-2 w-14 ${(percentChange ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"}`}
                >
                    {percentChange !== null ? `${percentChange.toFixed(2)}%` : t("widget.api_error")}
                </span>
                <span className="font-bold">
                    {price !== null
                        ? t(
                              "common.number",
                              market.currency
                                  ? { value: price, style: "currency", currency: market.currency, ...precision }
                                  : { value: price, ...precision }
                          )
                        : t("widget.api_error")}
                </span>
            </div>
        </div>
    );
}

/**
 * Renders the markets of a Yahoo Finance service widget, a loading text while the data arrives, or the container error state on a failure.
 *
 * @param props The service the widget belongs to.
 */
export default function Component({ service }: WidgetProps<MarketsOptions>) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data, error } = useWidgetAPI<MarketsData>(widget);

    if (error || data?.error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block value={t("yahoofinance.loading")} />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <div className="flex flex-col w-full">
                {data.markets.map((market) => (
                    <MarketItem key={market.symbol} market={market} />
                ))}
            </div>
        </Container>
    );
}
