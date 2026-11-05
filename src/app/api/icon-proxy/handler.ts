import { firstQueryValue } from "@/app/api/query";
import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { requestsNoCache } from "@/utils/cache-control";
import { sendIcon } from "@/utils/icon-response";
import { DEFAULT_MAX_AGE_SECONDS, getRemoteImage } from "@/utils/icons";
import { isImageUrlAllowed, isPublicOnlyImageUrl } from "@/utils/image-allowlist";
import createLogger from "@/utils/logger";

const logger = createLogger("iconProxy");

async function handler(req: ApiRequest, res: ApiResponse) {
    const url = firstQueryValue(req.query["url"]);
    if (!url) {
        logger.warn("Icon proxy request without a url");
        return res.status(400).send({ error: "Missing url" });
    }

    // Only addresses Foyer sent to the browser are fetched, and one that came from a feed or stream only from public hosts
    if (!(await isImageUrlAllowed(url))) {
        logger.warn("Icon proxy refused an address that is not an image Foyer serves");
        logger.debug("Icon proxy refused %s, which is not an image address from the config or a widget", url);
        return res.status(403).send({ error: "This address is not an image Foyer serves" });
    }

    // How long a copy may be reused, for images that change at a fixed URL such as a stream preview
    const requested = Number(firstQueryValue(req.query["maxAge"]));
    const maxAge =
        Number.isFinite(requested) && requested >= 0
            ? Math.floor(Math.min(requested, DEFAULT_MAX_AGE_SECONDS))
            : undefined;

    const image = await getRemoteImage(url, maxAge, await isPublicOnlyImageUrl(url), requestsNoCache(req.headers));
    if (!image) return res.status(404).send({ error: "Image not found" });

    return sendIcon(res, image, maxAge);
}

export default withAuth(handler);
