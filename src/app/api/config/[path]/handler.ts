import type { ApiRequest, ApiResponse } from "@/types/api";
import { withAuth } from "@/utils/auth";
import { CUSTOM_FILES, type CustomFile } from "@/utils/config/core";
import { getCustomFile } from "@/utils/config/store";

const MIME_TYPES: Record<CustomFile, string> = {
    "custom.css": "text/css",
    "custom.js": "text/javascript",
};

// Serves the customCss and customJs members of the config file
async function handler(req: ApiRequest, res: ApiResponse) {
    const { path: relativePath } = req.query;

    if (typeof relativePath !== "string" || !(CUSTOM_FILES as readonly string[]).includes(relativePath)) {
        return res.status(422).end("Unsupported file");
    }

    const file = relativePath as CustomFile;
    res.setHeader("Content-Type", MIME_TYPES[file]);
    return res.status(200).send(await getCustomFile(file));
}

export default withAuth(handler, { public: (req) => req.query?.["path"] === "custom.css" });
