import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/settings";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import createLogger from "@/utils/logger";
import { weatherApiFailure, weatherRequest } from "@/utils/weather/request";

const logger = createLogger("weatherapiHandler");

/**
 * Fetches the current weather for the requested coordinates from WeatherAPI, using the configured key, and answers 502 with the provider's message on failure.
 *
 * @param req The incoming API request.
 * @param res The API response.
 */
async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, provider, cache, lang, index } = req.query;
    const privateWidgetOptions = await getPrivateWidgetOptions("weatherapi", index as string);
    let apiKey = privateWidgetOptions?.apiKey;

    if (!apiKey && !provider) {
        logger.warn("The weatherapi widget at index %s has neither an apiKey nor a provider", index);
        return res.status(400).json({ error: "Missing API key or provider" });
    }

    if (!apiKey && provider !== "weatherapi") {
        logger.warn(
            'The weatherapi widget at index %s sets provider "%s"; only "weatherapi" works for it',
            index,
            provider
        );
        return res.status(400).json({ error: "Invalid provider for endpoint" });
    }

    if (!apiKey && provider) {
        const settings = await getSettings();
        apiKey = settings?.providers?.["weatherapi"] as string | undefined;
    }

    if (!apiKey) {
        logger.warn(
            'The weatherapi widget at index %s has no apiKey, and settings.providers has no "weatherapi" key',
            index
        );
        return res.status(400).json({ error: "Missing API key" });
    }

    const apiUrl = `http://api.weatherapi.com/v1/current.json?q=${latitude},${longitude}&key=${apiKey}&lang=${lang}`;

    return weatherRequest(res, logger, "weatherapi", apiUrl, numericQueryValue(cache), weatherApiFailure);
}

export default withAuth(handler);
