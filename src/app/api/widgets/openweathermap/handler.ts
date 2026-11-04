import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/settings";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import createLogger from "@/utils/logger";
import { openWeatherMapFailure, weatherRequest } from "@/utils/weather/request";

const logger = createLogger("openweathermapHandler");

/**
 * Fetches the current weather for the requested coordinates from OpenWeatherMap and answers 502 with the provider's message on failure.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, units, provider, cache, lang, index } = req.query;
    const privateWidgetOptions = await getPrivateWidgetOptions("openweathermap", index as string);
    let apiKey = privateWidgetOptions?.apiKey;

    if (!apiKey && !provider) {
        logger.warn("The openweathermap widget at index %s has neither an apiKey nor a provider", index);
        return res.status(400).json({ error: "Missing API key or provider" });
    }

    if (!apiKey && provider !== "openweathermap") {
        logger.warn(
            'The openweathermap widget at index %s sets provider "%s"; only "openweathermap" works for it',
            index,
            provider
        );
        return res.status(400).json({ error: "Invalid provider for endpoint" });
    }

    if (!apiKey && provider) {
        const settings = await getSettings();
        apiKey = settings?.providers?.["openweathermap"] as string | undefined;
    }

    if (!apiKey) {
        logger.warn(
            'The openweathermap widget at index %s has no apiKey, and settings.providers has no "openweathermap" key',
            index
        );
        return res.status(400).json({ error: "Missing API key" });
    }

    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=${units}&lang=${lang}`;

    return weatherRequest(res, logger, "openweathermap", apiUrl, numericQueryValue(cache), openWeatherMapFailure);
}

export default withAuth(handler);
