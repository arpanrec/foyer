import type { ApiQueryValue } from "@/types/api";

// A query parameter repeated in the URL arrives as an array; the first value wins
export function firstQueryValue(value: ApiQueryValue): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

// A cache duration in minutes, left undefined so the callee's default applies
export function numericQueryValue(value: ApiQueryValue): number | undefined {
    const first = firstQueryValue(value);
    return first === undefined ? undefined : Number(first);
}
