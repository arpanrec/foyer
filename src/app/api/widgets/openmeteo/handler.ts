import { numericQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { cachedRequest } from "@/utils/proxy/http";

async function handler(req: ApiRequest, res: ApiResponse) {
    const { latitude, longitude, units, cache, timezone } = req.query;
    const degrees = units === "metric" ? "celsius" : "fahrenheit";
    const timezeone = timezone ?? "auto";
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=sunrise,sunset&current_weather=true&temperature_unit=${degrees}&timezone=${timezeone}`;
    return res.send(await cachedRequest(apiUrl, numericQueryValue(cache)));
}

export default withAuth(handler);
