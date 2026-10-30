import { withRouteAuth } from "@/utils/app-auth";
import { getSettings } from "@/utils/config/config";
import themes from "@/utils/styles/themes";

async function getResponse() {
    const settings = getSettings();

    const color = settings.color || "slate";
    const theme = settings.theme || "dark";

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/mstile-150x150.png?v=2"/>
            <TileColor>${themes[color][theme]}</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;

    return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = withRouteAuth(getResponse);
