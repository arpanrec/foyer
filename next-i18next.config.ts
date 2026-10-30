// prettyBytes taken from https://github.com/sindresorhus/pretty-bytes

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const BIBYTE_UNITS = ["B", "kiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

const BIT_UNITS = ["b", "kbit", "Mbit", "Gbit", "Tbit", "Pbit", "Ebit", "Zbit", "Ybit"];

const BIBIT_UNITS = ["b", "kibit", "Mibit", "Gibit", "Tibit", "Pibit", "Eibit", "Zibit", "Yibit"];

// The part of i18next that the formatters below use. Formatter options come from the
// `{{value, format(option: x)}}` placeholders in translations.
type I18nextLike = {
    t?: (key: string) => string;
    services: {
        formatter: { add: (name: string, format: (value: never, lng: string, options: never) => string) => void };
    };
};

/*
Formats the given number using `Number#toLocaleString`.
- If locale is a string, the value is expected to be a locale-key (for example: `de`).
- If locale is true, the system default locale is used for translation.
- If no value for locale is specified, the number is returned unmodified.
*/
const toLocaleString = (number: number, locale: unknown, options?: Intl.NumberFormatOptions): string | number => {
    let result: string | number = number;
    if (typeof locale === "string" || Array.isArray(locale)) {
        result = number.toLocaleString(locale, options);
    } else if (locale === true || options !== undefined) {
        result = number.toLocaleString(undefined, options);
    }

    return result;
};

type PrettyBytesOptions = {
    bits?: boolean;
    binary?: boolean;
    signed?: boolean;
    locale?: string | string[] | boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
};

function prettyBytes(number: number, options?: PrettyBytesOptions) {
    if (!Number.isFinite(number)) {
        throw new TypeError(`Expected a finite number, got ${typeof number}: ${number}`);
    }

    options = {
        bits: false,
        binary: false,
        ...options,
    };

    const UNITS = options.bits
        ? options.binary
            ? BIBIT_UNITS
            : BIT_UNITS
        : options.binary
          ? BIBYTE_UNITS
          : BYTE_UNITS;

    if (options.signed && number === 0) {
        return ` 0 ${UNITS[0]}`;
    }

    const isNegative = number < 0;

    const prefix = isNegative ? "-" : options.signed ? "+" : "";

    if (isNegative) {
        number = -number;
    }

    let localeOptions;

    if (options.minimumFractionDigits !== undefined) {
        localeOptions = { minimumFractionDigits: options.minimumFractionDigits };
    }

    if (options.maximumFractionDigits !== undefined) {
        localeOptions = { maximumFractionDigits: options.maximumFractionDigits, ...localeOptions };
    }

    if (number < 1) {
        const numberString = toLocaleString(number, options.locale, localeOptions);
        return `${prefix + numberString} ${UNITS[0]}`;
    }

    const exponent = Math.min(
        Math.floor(options.binary ? Math.log(number) / Math.log(1024) : Math.log10(number) / 3),
        UNITS.length - 1
    );
    number /= (options.binary ? 1024 : 1000) ** exponent;

    const scaled = localeOptions ? number : number.toPrecision(3);

    const numberString = toLocaleString(Number(scaled), options.locale, localeOptions);

    const unit = UNITS[exponent];

    return `${prefix + numberString} ${unit}`;
}

function duration(durationInSeconds: number, i18next: I18nextLike) {
    const mo = Math.floor(durationInSeconds / (3600 * 24 * 31));
    const d = Math.floor((durationInSeconds % (3600 * 24 * 31)) / (3600 * 24));
    const h = Math.floor((durationInSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((durationInSeconds % 3600) / 60);
    const s = Math.floor(durationInSeconds % 60);

    const t = (key: string) => i18next.t?.(key) ?? "";
    const moDisplay = mo > 0 ? mo + t("common.months") : "";
    const dDisplay = d > 0 ? d + t("common.days") : "";
    const hDisplay = h > 0 && mo === 0 ? h + t("common.hours") : "";
    const mDisplay = m > 0 && mo === 0 && d === 0 ? m + t("common.minutes") : "";
    const sDisplay = s > 0 && mo === 0 && d === 0 && h === 0 ? s + t("common.seconds") : "";

    return (moDisplay + dDisplay + hDisplay + mDisplay + sDisplay).replace(/,\s*$/, "");
}

function relativeDate(date: Date, formatter: Intl.RelativeTimeFormat) {
    const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
    const units: Intl.RelativeTimeFormatUnit[] = ["second", "minute", "hour", "day", "week", "month", "year"];

    const delta = Math.round((date.getTime() - Date.now()) / 1000);
    const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(delta));
    const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

    if (units[unitIndex] === "day") {
        // compare calendar days, not elapsed 24h blocks
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return formatter.format(
            Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000),
            "day"
        );
    }

    return formatter.format(Math.floor(delta / divisor), units[unitIndex]);
}

export const i18n = {
    defaultLocale: "en",
    locales: ["en"],
};

const nextI18nextConfig = {
    i18n,
    serializeConfig: false,
    // see https://github.com/i18next/i18next/issues/2227
    cacheInBuiltFormats: false,
    use: [
        {
            init: (i18next: I18nextLike) => {
                i18next.services.formatter.add("bytes", (value: string, lng: string, options: PrettyBytesOptions) =>
                    prettyBytes(parseFloat(value), { locale: lng, ...options })
                );

                i18next.services.formatter.add(
                    "rate",
                    (value: number, lng: string, options: PrettyBytesOptions & { decimals?: number }) => {
                        const k = options.binary ? 1024 : 1000;
                        const sizes = options.bits
                            ? options.binary
                                ? BIBIT_UNITS
                                : BIT_UNITS
                            : options.binary
                              ? BIBYTE_UNITS
                              : BYTE_UNITS;

                        if (value === 0) return `0 ${sizes[0]}/s`;

                        const dm = options.decimals ? options.decimals : 0;

                        const i = Math.floor(Math.log(value) / Math.log(k));

                        const formatted = new Intl.NumberFormat(lng, {
                            maximumFractionDigits: dm,
                            minimumFractionDigits: dm,
                        }).format(value / k ** i);

                        return `${formatted} ${sizes[i]}/s`;
                    }
                );

                i18next.services.formatter.add(
                    "percent",
                    (value: string, lng: string, options: Intl.NumberFormatOptions) =>
                        new Intl.NumberFormat(lng, { style: "percent", ...options }).format(parseFloat(value) / 100.0)
                );
                i18next.services.formatter.add(
                    "date",
                    (value: string | number | Date, lng: string, options: Intl.DateTimeFormatOptions) =>
                        new Intl.DateTimeFormat(lng, { ...options }).format(new Date(value))
                );
                i18next.services.formatter.add(
                    "relativeDate",
                    (value: string | number | Date, lng: string, options: Intl.RelativeTimeFormatOptions) =>
                        relativeDate(new Date(value), new Intl.RelativeTimeFormat(lng, { ...options }))
                );
                i18next.services.formatter.add("duration", (value: number, _lng: string) => duration(value, i18next));
            },
            type: "3rdParty",
        },
    ],
};

export default nextI18nextConfig;
