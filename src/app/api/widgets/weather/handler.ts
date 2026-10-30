import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/config";
import { getPrivateWidgetOptions } from "@/utils/config/widget-helpers";
import { cachedRequest } from "@/utils/proxy/http";

async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, provider, cache, lang, index } = req.query;
    const privateWidgetOptions = await getPrivateWidgetOptions("weatherapi", index as string);
    let apiKey = privateWidgetOptions?.apiKey;

    if (!apiKey && !provider) {
        return res.status(400).json({ error: "Missing API key or provider" });
    }

    if (!apiKey && provider !== "weatherapi") {
        return res.status(400).json({ error: "Invalid provider for endpoint" });
    }

    if (!apiKey && provider) {
        const settings = getSettings();
        apiKey = settings?.providers?.weatherapi as string | undefined;
    }

    if (!apiKey) {
        return res.status(400).json({ error: "Missing API key" });
    }

    const apiUrl = `http://api.weatherapi.com/v1/current.json?q=${latitude},${longitude}&key=${apiKey}&lang=${lang}`;

    return res.send(await cachedRequest(apiUrl, numericQueryValue(cache)));
}

export default withAuth(handler);
