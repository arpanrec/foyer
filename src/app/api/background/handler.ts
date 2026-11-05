import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { requestsNoCache } from "@/utils/cache-control";
import { getSettings } from "@/utils/config/settings";
import { sendIcon } from "@/utils/icon-response";
import { getRemoteImage } from "@/utils/icons";
import { absoluteImageUrl } from "@/utils/image-url";
import createLogger from "@/utils/logger";

const logger = createLogger("background");

// Serves the image behind the `background` setting when it is a full URL. It takes no URL from the request, so it
// stays public for the sign-in page without becoming a way to fetch other addresses. A request with
// Cache-Control: no-cache downloads it again.
async function handler(req: ApiRequest, res: ApiResponse) {
    const { background } = await getSettings();
    const configured = typeof background === "string" ? background : background?.image;
    const url = configured ? absoluteImageUrl(configured) : undefined;

    if (!url) return res.status(404).send({ error: "No background URL configured" });

    const image = await getRemoteImage(url, undefined, false, requestsNoCache(req.headers));
    if (!image) {
        logger.warn("The settings background %s could not be fetched as an image", url);
        return res.status(404).send({ error: "Background not found" });
    }

    return sendIcon(res, image);
}

export default withAuth(handler, { public: () => true });
