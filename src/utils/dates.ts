/**
 * Converts a date string to ISO 8601.
 *
 * @param value The date string, as found in a feed.
 * @returns The ISO string, or null when the value is missing or not a date.
 */
export function toIsoDate(value: string | undefined): string | null {
    if (value === undefined) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Sort comparator that puts the newest item first and undated items last.
 *
 * @param a The first item.
 * @param b The second item.
 * @returns A negative, zero or positive number.
 */
export const byDateDesc = (a: { date: string | null }, b: { date: string | null }) =>
    (b.date ?? "").localeCompare(a.date ?? "");
