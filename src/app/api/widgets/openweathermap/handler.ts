import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/config";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import { cachedRequest } from "@/utils/proxy/http";

async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, units, provider, cache, lang, index } = req.query;
    const privateWidgetOptions = await getPrivateWidgetOptions("openweathermap", index as string);
    let apiKey = privateWidgetOptions?.apiKey;

    if (!apiKey && !provider) {
        return res.status(400).json({ error: "Missing API key or provider" });
    }

    if (!apiKey && provider !== "openweathermap") {
        return res.status(400).json({ error: "Invalid provider for endpoint" });
    }

    if (!apiKey && provider) {
        const settings = getSettings();
        apiKey = settings?.providers?.openweathermap as string | undefined;
    }

    if (!apiKey) {
        return res.status(400).json({ error: "Missing API key" });
    }

    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=${units}&lang=${lang}`;

    return res.send(await cachedRequest(apiUrl, numericQueryValue(cache)));
}

export default withAuth(handler);
