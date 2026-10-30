import type { ReactNode } from "react";

import * as shvl from "@/utils/config/shvl";
import type { CustomapiFormat, CustomapiMapping, Translate } from "@/widgets/customapi/types";

export function getValue(field: unknown, data: unknown): unknown {
    let value = data;
    let lastField: unknown = field;
    let key: string | null = "";

    // Support APIs that return arrays or scalars directly.
    if (typeof field === "undefined") {
        return value;
    }

    // shvl is easier, everything else is kept for backwards compatibility.
    if (typeof field === "string") {
        return shvl.get(data, field, null) ?? (data as Record<string, unknown>)[field] ?? null;
    }

    while (typeof lastField === "object") {
        const path = lastField as Record<string, unknown>;
        key = Object.keys(path)[0] ?? null;

        if (key === null) {
            break;
        }

        value = (value as Record<string, unknown>)[key];
        lastField = path[key];
    }

    if (typeof value === "undefined") {
        return null;
    }

    return (value as Record<string, unknown>)[lastField as string] ?? null;
}

export function getSize(data: unknown) {
    if (Array.isArray(data) || typeof data === "string") {
        return data.length;
    } else if (typeof data === "object" && data !== null) {
        return Object.keys(data).length;
    }

    return NaN;
}

export function formatValue(t: Translate, mapping: CustomapiFormat | undefined, rawValue: unknown): ReactNode {
    let value = rawValue as ReactNode;

    // Remap the value.
    const remaps = mapping?.remap ?? [];
    for (let i = 0; i < remaps.length; i += 1) {
        const remap = remaps[i];
        if (remap?.any || remap?.value === value) {
            value = remap.to;
            break;
        }
    }

    // Scale the value. Accepts either a number to multiply by or a string
    // like "12/345".
    const scale = mapping?.scale;
    if (typeof scale === "number") {
        value = Number(value) * scale;
    } else if (typeof scale === "string") {
        const parts = scale.split("/");
        const numerator = parts[0] ? parseFloat(parts[0]) : 1;
        const denominator = parts[1] ? parseFloat(parts[1]) : 1;
        value = (Number(value) * numerator) / denominator;
    }

    // Format the value using a known type.
    switch (mapping?.format) {
        case "number":
            value = t("common.number", { value: parseInt(String(value), 10) });
            break;
        case "float":
            value = t("common.number", { value });
            break;
        case "percent":
            value = t("common.percent", { value });
            break;
        case "duration":
            value = t("common.duration", { value });
            break;
        case "bytes":
            value = t("common.bytes", { value });
            break;
        case "bitrate":
            value = t("common.bitrate", { value });
            break;
        case "date":
            value = t("common.date", {
                value,
                lng: mapping?.locale,
                dateStyle: mapping?.dateStyle ?? "long",
                timeStyle: mapping?.timeStyle,
            });
            break;
        case "relativeDate":
            value = t("common.relativeDate", {
                value,
                lng: mapping?.locale,
                style: mapping?.style,
                numeric: mapping?.numeric,
            });
            break;
        case "size":
            value = t("common.number", { value: getSize(value) });
            break;
        case "text":
        default:
        // nothing
    }

    // Apply fixed prefix.
    const prefix = mapping?.prefix;
    if (prefix) {
        value = `${prefix} ${value}`;
    }

    // Apply fixed suffix.
    const suffix = mapping?.suffix;
    if (suffix) {
        value = `${value} ${suffix}`;
    }

    return value;
}

export function getColor(mapping: CustomapiMapping, customData: unknown) {
    const { field, color } = mapping.additionalField ?? {};
    const value = getValue(field, customData);

    switch (color) {
        case "adaptive":
            try {
                const number = parseFloat(String(value));
                return number > 0 ? "text-emerald-300" : "text-rose-300";
            } catch (e) {
                return "";
            }
        case "black":
            return `text-black`;
        case "white":
            return `text-white`;
        case "theme":
            return `text-theme-500`;
        default:
            return "";
    }
}
