import type winston from "winston";

import type { ApiResponse } from "@/types/api";
import cache from "@/utils/cache";
import { errorMessage } from "@/utils/error";
import { cachedRequest } from "@/utils/proxy/http";

// Returns why a weather API body is an error, or undefined when the body is data. Each provider reports a
// failure in its own shape, often with an HTTP 200.
export type WeatherFailure = (data: unknown) => string | undefined;

/**
 * Narrows a value to a plain object.
 *
 * @param value The value to test.
 * @returns True for a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a failure reason from an Open-Meteo body, which reports `{ error: true, reason }`.
 *
 * @param data The parsed response body.
 * @returns The reason, or undefined when the body is data.
 */
export const openMeteoFailure: WeatherFailure = (data) => {
    if (!isRecord(data)) return "the response is not JSON";
    if (data["error"] !== true) return undefined;
    return typeof data["reason"] === "string" ? data["reason"] : "no reason given";
};

/**
 * Reads a failure reason from a WeatherAPI body, which reports `{ error: { code, message } }`.
 *
 * @param data The parsed response body.
 * @returns The reason, or undefined when the body is data.
 */
export const weatherApiFailure: WeatherFailure = (data) => {
    if (!isRecord(data)) return "the response is not JSON";
    const error = data["error"];
    if (error === undefined) return undefined;
    return isRecord(error) && typeof error["message"] === "string" ? error["message"] : "no reason given";
};

/**
 * Reads a failure reason from an OpenWeatherMap body, which reports `{ cod, message }` and uses `cod` 200 for data.
 *
 * @param data The parsed response body.
 * @returns The reason, or undefined when the body is data.
 */
export const openWeatherMapFailure: WeatherFailure = (data) => {
    if (!isRecord(data)) return "the response is not JSON";
    const cod = data["cod"];
    if (cod === undefined || Number(cod) === 200) return undefined;
    return typeof data["message"] === "string" ? data["message"] : `code ${String(cod)}`;
};

/**
 * Fetches a weather API through the shared cache and answers the route. A failure is logged at `error` with the widget's name, answered as 502 with `{ error }`, and dropped from the cache so the next request asks the API again. The URL carries the API key, so it is never logged. An empty reason is replaced with "no reason given".
 *
 * @param res The API response.
 * @param logger The logger of the calling route.
 * @param widget The widget name used in log lines.
 * @param url The API URL, including its key.
 * @param cacheMinutes How long to cache a good response.
 * @param failure Reads a failure reason from the body.
 */
export async function weatherRequest(
    res: ApiResponse,
    logger: winston.Logger,
    widget: string,
    url: string,
    cacheMinutes: number | undefined,
    failure: WeatherFailure
) {
    try {
        const data = await cachedRequest(url, cacheMinutes);
        const failed = failure(data);
        if (failed === undefined) return res.send(data);
        const reason = failed || "no reason given";

        await cache.del(url, "response");
        logger.error("The %s widget got an error from its weather API: %s", widget, reason);
        return res.status(502).json({ error: reason });
    } catch (e) {
        // httpProxy rejects with [status, error]
        const cause = Array.isArray(e) ? e[1] : e;
        const reason = errorMessage(cause) ?? "the request failed";
        await cache.del(url, "response");
        logger.error("The %s widget could not reach its weather API: %s", widget, reason);
        logger.debug(cause);
        return res.status(502).json({ error: reason });
    }
}
