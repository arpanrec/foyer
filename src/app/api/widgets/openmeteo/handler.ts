import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import createLogger from "@/utils/logger";
import { openMeteoFailure, weatherRequest } from "@/utils/weather/request";

const logger = createLogger("openmeteoHandler");

/**
 * Fetches the forecast for the requested coordinates from Open-Meteo and answers 502 with the provider's reason on failure.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, units, cache, timezone } = req.query;
    const degrees = units === "metric" ? "celsius" : "fahrenheit";
    const timezeone = timezone ?? "auto";
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=sunrise,sunset&current_weather=true&temperature_unit=${degrees}&timezone=${timezeone}`;
    return weatherRequest(res, logger, "openmeteo", apiUrl, numericQueryValue(cache), openMeteoFailure);
}

export default withAuth(handler);
