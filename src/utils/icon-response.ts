import type { ApiResponse } from "@/types/api";
import { DEFAULT_MAX_AGE_SECONDS, type IconResult } from "@/utils/icons";

// An icon is kept for `maxAgeSeconds`, and an SVG must not run script or load anything when opened directly
export function sendIcon(res: ApiResponse, icon: IconResult, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS) {
    res.setHeader("Content-Type", icon.contentType);
    res.setHeader("Cache-Control", `private, max-age=${maxAgeSeconds}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return res.send(icon.body);
}
