import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";

import Dropdown from "@/components/services/dropdown";
import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { CoinmarketcapOptions, CoinmarketcapQuotes } from "@/widgets/coinmarketcap/types";

// The first entry of the range dropdown, and the range shown when the config sets no defaultinterval
const DEFAULT_INTERVAL = "1h";

export default function Component({ service }: WidgetProps<CoinmarketcapOptions>) {
    const { t } = useTranslation();

    const dateRangeOptions = [
        { label: t("coinmarketcap.1hour"), value: DEFAULT_INTERVAL },
        { label: t("coinmarketcap.1day"), value: "24h" },
        { label: t("coinmarketcap.7days"), value: "7d" },
        { label: t("coinmarketcap.30days"), value: "30d" },
    ];

    const { widget } = service;
    const { symbols } = widget;
    const { slugs } = widget;
    const currencyCode = widget.currency ?? "USD";
    const interval = widget.defaultinterval ?? DEFAULT_INTERVAL;

    const [dateRange, setDateRange] = useState(interval);

    const params: Record<string, string> = {
        convert: `${currencyCode}`,
    };

    // slugs >> symbols, not both
    if (slugs?.length) {
        params["slug"] = slugs.join(",");
    } else if (symbols?.length) {
        params["symbol"] = symbols.join(",");
    }

    const { data: statsData, error: statsError } = useWidgetAPI<CoinmarketcapQuotes>(
        widget,
        "v1/cryptocurrency/quotes/latest",
        params
    );

    if ((!symbols && !slugs) || (symbols?.length === 0 && slugs?.length === 0)) {
        return (
            <Container service={service}>
                <Block value={t("coinmarketcap.configure")} />
            </Container>
        );
    }

    if (statsError) {
        return <Container service={service} error={statsError} />;
    }

    if (!statsData || !dateRange) {
        return (
            <Container service={service}>
                <Block value={t("coinmarketcap.configure")} />
            </Container>
        );
    }

    const { data } = statsData;
    // a crypto without a quote in the currency, or without a change for the range, is left out
    const validCryptos = Object.values(data).flatMap((crypto) => {
        const quote = crypto.quote[currencyCode];
        const change = quote?.[`percent_change_${dateRange}`];
        return quote && change !== undefined && change !== null ? [{ crypto, quote, change }] : [];
    });

    return (
        <Container service={service}>
            <div className={classNames(service.description ? "-top-10" : "-top-8", "absolute right-1 z-20")}>
                <Dropdown options={dateRangeOptions} value={dateRange} setValue={setDateRange} />
            </div>

            <div className="flex flex-col w-full">
                {validCryptos.map(({ crypto, quote, change }) => (
                    <div
                        key={crypto.id}
                        className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs"
                    >
                        <div className="font-thin pl-2">{crypto.name}</div>
                        <div className="flex flex-row text-right">
                            <div className="font-bold mr-2">
                                {t("common.number", {
                                    value: quote.price,
                                    style: "currency",
                                    currency: currencyCode,
                                })}
                            </div>
                            <div className={`font-bold w-10 mr-2 ${change > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                {change.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Container>
    );
}
