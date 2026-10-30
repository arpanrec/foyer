import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18nextConfig from "../../next-i18next.config";

type RelativeDateFormatter = (value: string, language: string, options: Intl.RelativeTimeFormatOptions) => string;

function getRelativeDateFormatter() {
    let relativeDateFormatter: RelativeDateFormatter = () => "";

    i18nextConfig.use[0].init({
        services: {
            formatter: {
                add(name: string, formatter: unknown) {
                    if (name === "relativeDate") relativeDateFormatter = formatter as RelativeDateFormatter;
                },
            },
        },
    });

    return relativeDateFormatter;
}

describe("relativeDate formatter", () => {
    const formatRelativeDate = getRelativeDateFormatter();
    const options: Intl.RelativeTimeFormatOptions = { numeric: "auto" };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 23, 16, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ["hours away on the same day", new Date(2026, 8, 23, 20, 0), "in 4 hours"],
        ["next calendar day", new Date(2026, 8, 24, 20, 0), "tomorrow"],
        ["two calendar days away but under 48h", new Date(2026, 8, 25, 10, 40), "in 2 days"],
        ["previous calendar day", new Date(2026, 8, 22, 10, 0), "yesterday"],
        ["two calendar days ago but under 48h", new Date(2026, 8, 21, 20, 0), "2 days ago"],
    ])("formats %s", (_description, value, expected) => {
        expect(formatRelativeDate(value.toISOString(), "en", options)).toBe(expected);
    });
});
