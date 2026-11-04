import { getSettings } from "@/utils/config/settings";

export const dynamic = "force-dynamic";

export async function GET() {
    const settings = await getSettings();
    const content = ["User-agent: *", !!settings.disableIndexing ? "Disallow: /" : "Allow: /"].join("\n");

    return new Response(content, { headers: { "Content-Type": "text/plain" } });
}
