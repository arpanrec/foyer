import { getSettings } from "@/utils/config/config";

export const dynamic = "force-dynamic";

export function GET() {
    const settings = getSettings();
    const content = ["User-agent: *", !!settings.disableIndexing ? "Disallow: /" : "Allow: /"].join("\n");

    return new Response(content, { headers: { "Content-Type": "text/plain" } });
}
