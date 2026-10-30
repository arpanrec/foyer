import type { WidgetConfig } from "@/types/service";

export function formatApiCall(url: string | undefined, args: Record<string, unknown>): string {
    if (!url) return "";
    const find = /\{.*?\}/g;
    const replace = (match: string) => {
        const key = match.replace(/\{|\}/g, "");
        let value = args[key];
        if (key === "url" && typeof value === "string") {
            value = value.replace(/\/+$/, ""); // remove trailing slashes
        }
        return (value as { toString(): string } | null | undefined)?.toString() || "";
    };

    return url.replace(find, replace).replace(find, replace);
}

export function parseVersionForUrl<T = null>(version: unknown, defaultValue: T = null as T): number | T {
    if (version === undefined || version === null || version === "") {
        return defaultValue;
    }

    if (typeof version === "number") {
        return Number.isInteger(version) && version >= 0 ? version : defaultValue;
    }

    if (typeof version === "string" && /^\d+$/.test(version)) {
        return Number(version);
    }

    return defaultValue;
}

type ProxyWidget = Pick<WidgetConfig, "service_group" | "service_name" | "index">;

export function getURLSearchParams(widget: ProxyWidget, endpoint?: string | null) {
    const params = new URLSearchParams({
        group: String(widget.service_group),
        service: String(widget.service_name),
        index: String(widget.index),
    });
    if (endpoint) {
        params.append("endpoint", endpoint);
    }
    return params;
}

export function formatProxyUrl(widget: ProxyWidget, endpoint?: string | null, queryParams?: Record<string, unknown>) {
    const params = getURLSearchParams(widget, endpoint);
    if (queryParams) {
        params.append("query", JSON.stringify(queryParams));
    }
    return `/api/services/proxy?${params.toString()}`;
}

// Parses a raw proxied body (a Buffer or string) as JSON; an empty or already parsed value is returned as is.
export function asJson<T = unknown>(data: unknown): T {
    if (typeof data === "string" || Buffer.isBuffer(data)) {
        if (data.length > 0) return JSON.parse(data.toString()) as T;
    }
    return data as T;
}

export function jsonArrayTransform<T, R>(data: unknown, transform: (items: T[]) => R): R | T[] {
    const json = asJson<T[]>(data);
    if (json instanceof Array) {
        return transform(json);
    }
    return json;
}

export function jsonArrayFilter<T>(data: unknown, filter: (item: T) => boolean): T[] {
    return jsonArrayTransform<T, T[]>(data, (items) => items.filter(filter)) as T[];
}

// The `error` object `httpProxy` returns in place of a body when a call fails, or that an upstream sends
export type ProxyErrorBody = { message?: string; url?: string; rawError?: unknown; code?: unknown };

export function getProxyError(data: unknown): ProxyErrorBody | undefined {
    if (typeof data !== "object" || data === null || !("error" in data)) return undefined;
    const { error } = data;
    return typeof error === "object" && error !== null ? error : undefined;
}

export function sanitizeErrorURL(errorURL: string | URL) {
    return `${new URL(errorURL).hostname} (see logs for details)`;
}
