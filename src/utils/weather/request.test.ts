import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "@/test-utils/create-mock-res";
import type { ApiResponse } from "@/types/api";

const { cachedRequest, cacheDel, logger } = vi.hoisted(() => ({
    cachedRequest: vi.fn(),
    cacheDel: vi.fn(),
    logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/utils/proxy/http", () => ({ cachedRequest }));
vi.mock("@/utils/cache", () => ({ default: { del: cacheDel } }));

import { openMeteoFailure, openWeatherMapFailure, weatherApiFailure, weatherRequest } from "@/utils/weather/request";

const url = "https://api.example.com/v1?key=SECRET";

describe("utils/weather/request failure detectors", () => {
    it("reads the Open-Meteo error body", () => {
        expect(openMeteoFailure({ error: true, reason: "The service is overloaded" })).toBe(
            "The service is overloaded"
        );
        expect(openMeteoFailure({ error: true })).toBe("no reason given");
        expect(openMeteoFailure({ current_weather: {} })).toBeUndefined();
        expect(openMeteoFailure("<html>")).toBe("the response is not JSON");
    });

    it("reads the WeatherAPI error body", () => {
        expect(weatherApiFailure({ error: { code: 2008, message: "API key disabled" } })).toBe("API key disabled");
        expect(weatherApiFailure({ error: {} })).toBe("no reason given");
        expect(weatherApiFailure({ current: {} })).toBeUndefined();
        expect(weatherApiFailure("<html>")).toBe("the response is not JSON");
    });

    it("reads the OpenWeatherMap error body", () => {
        expect(openWeatherMapFailure({ cod: 401, message: "Invalid API key" })).toBe("Invalid API key");
        expect(openWeatherMapFailure({ cod: "429" })).toBe("code 429");
        expect(openWeatherMapFailure({ cod: 200, main: {} })).toBeUndefined();
        expect(openWeatherMapFailure({ main: {} })).toBeUndefined();
        expect(openWeatherMapFailure("<html>")).toBe("the response is not JSON");
    });
});

describe("utils/weather/request weatherRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends the data when the API answers normally", async () => {
        cachedRequest.mockResolvedValueOnce({ current_weather: {} });
        const res = createMockRes();

        await weatherRequest(res as ApiResponse, logger as never, "openmeteo", url, 5, openMeteoFailure);

        expect(cachedRequest).toHaveBeenCalledWith(url, 5);
        expect(res.body).toEqual({ current_weather: {} });
        expect(logger.error).not.toHaveBeenCalled();
        expect(cacheDel).not.toHaveBeenCalled();
    });

    it("logs an error, answers 502 and drops the cached failure when the body is an error", async () => {
        cachedRequest.mockResolvedValueOnce({ error: true, reason: "The service is overloaded" });
        const res = createMockRes();

        await weatherRequest(res as ApiResponse, logger as never, "openmeteo", url, 5, openMeteoFailure);

        expect(res.statusCode).toBe(502);
        expect(res.body).toEqual({ error: "The service is overloaded" });
        expect(cacheDel).toHaveBeenCalledWith(url, "response");
        expect(logger.error).toHaveBeenCalledWith(
            "The %s widget got an error from its weather API: %s",
            "openmeteo",
            "The service is overloaded"
        );
    });

    it("replaces an empty failure reason so the widget still sees an error", async () => {
        cachedRequest.mockResolvedValueOnce({ error: true, reason: "" });
        const res = createMockRes();

        await weatherRequest(res as ApiResponse, logger as never, "openmeteo", url, 5, () => "");

        expect(res.statusCode).toBe(502);
        expect(res.body).toEqual({ error: "no reason given" });
    });

    it("logs an error and answers 502 when the request fails, without logging the URL", async () => {
        cachedRequest.mockRejectedValueOnce([500, new Error("getaddrinfo ENOTFOUND api.example.com")]);
        const res = createMockRes();

        await weatherRequest(res as ApiResponse, logger as never, "weatherapi", url, 5, weatherApiFailure);

        expect(res.statusCode).toBe(502);
        expect(res.body).toEqual({ error: "getaddrinfo ENOTFOUND api.example.com" });
        expect(logger.error).toHaveBeenCalledWith(
            "The %s widget could not reach its weather API: %s",
            "weatherapi",
            "getaddrinfo ENOTFOUND api.example.com"
        );
        expect(JSON.stringify(logger.error.mock.calls)).not.toContain("SECRET");
    });

    it("reads the reason from a plain error and falls back when there is none", async () => {
        const res1 = createMockRes();
        cachedRequest.mockRejectedValueOnce(new Error("socket hang up"));
        await weatherRequest(res1 as ApiResponse, logger as never, "weatherapi", url, 5, weatherApiFailure);
        expect(res1.body).toEqual({ error: "socket hang up" });

        const res2 = createMockRes();
        cachedRequest.mockRejectedValueOnce(undefined);
        await weatherRequest(res2 as ApiResponse, logger as never, "weatherapi", url, 5, weatherApiFailure);
        expect(res2.statusCode).toBe(502);
        expect(res2.body).toEqual({ error: "the request failed" });
    });
});
