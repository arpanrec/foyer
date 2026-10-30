import { firstQueryValue } from "@/app/api/query";
import { searchProviders } from "@/components/widgets/search/providers";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { getSettings } from "@/utils/config/config";
import { widgetsFromConfig } from "@/utils/config/widget-helpers";
import { cachedRequest } from "@/utils/proxy/http";

async function handler(req: ApiRequest, res: ApiResponse) {
    const { query, providerName } = req.query;

    const provider = Object.values(searchProviders).find(({ name }) => name === providerName);

    if (!provider) {
        return res.json([query, []]);
    }

    if (provider.name === "Custom") {
        const widgets = await widgetsFromConfig();
        const searchWidget = widgets.find((w) => w.type === "search");

        if (searchWidget) {
            provider.url = searchWidget.options.url as string;
            provider.suggestionUrl = searchWidget.options.suggestionUrl as string;
        } else {
            const settings = getSettings();
            if (settings.quicklaunch && settings.quicklaunch.provider === "custom") {
                provider.url = settings.quicklaunch.url as string;
                provider.suggestionUrl = settings.quicklaunch.suggestionUrl as string;
            }
        }
    }

    if (!provider.suggestionUrl) {
        return res.json([query, []]); // Responde with the same array format but with no suggestions.
    }

    return res.send(
        await cachedRequest(
            `${provider.suggestionUrl}${encodeURIComponent(String(firstQueryValue(query)))}`,
            5,
            "Mozilla/5.0"
        )
    );
}

export default withAuth(handler);
