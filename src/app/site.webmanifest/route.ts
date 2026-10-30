import { withRouteAuth } from "@/utils/app-auth";
import checkAndCopyConfig, { getSettings } from "@/utils/config/config";
import themes from "@/utils/styles/themes";

async function getResponse() {
    checkAndCopyConfig("settings.yaml");
    const settings = getSettings();

    const color = settings.color || "slate";
    const theme = settings.theme || "dark";

    const pwa = settings.pwa || {};

    const manifest = {
        name: settings.title || "Foyer",
        short_name: settings.title || "Foyer",
        icons: pwa.icons || [
            {
                src: "/android-chrome-192x192.png?v=2",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/android-chrome-512x512.png?v=2",
                sizes: "512x512",
                type: "image/png",
            },
        ],
        shortcuts: pwa.shortcuts,
        theme_color: themes[color][theme],
        background_color: themes[color][theme],
        display: "standalone",
        start_url: settings.startUrl || "/",
    };

    return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json" } });
}

export const GET = withRouteAuth(getResponse);
