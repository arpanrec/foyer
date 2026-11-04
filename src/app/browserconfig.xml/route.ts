import { withRouteAuth } from "@/utils/app-auth";
import { getSettings } from "@/utils/config/settings";
import { getThemeColor } from "@/utils/styles/themes";

async function getResponse() {
    const settings = await getSettings();

    const color = settings.color || "slate";
    const theme = settings.theme || "dark";

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/mstile-150x150.png?v=2"/>
            <TileColor>${getThemeColor(color, theme)}</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;

    return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = withRouteAuth(getResponse);
