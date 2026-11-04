import { withRouteAuth } from "@/utils/app-auth";
import { getSettings } from "@/utils/config/settings";
import { proxiedImageUrl } from "@/utils/image-url";
import { getThemeColor } from "@/utils/styles/themes";

// Icons the user gave as full URLs are fetched by the server, never by the browser
function proxiedIcons(icons: unknown) {
    if (!Array.isArray(icons)) return icons;
    return icons.map((icon: unknown) =>
        icon && typeof icon === "object" && "src" in icon && typeof icon.src === "string"
            ? { ...icon, src: proxiedImageUrl(icon.src) }
            : icon
    );
}

async function getResponse() {
    const settings = await getSettings();

    const color = settings.color || "slate";
    const theme = settings.theme || "dark";

    const pwa = settings.pwa || {};

    const manifest = {
        name: settings.title || "Foyer",
        short_name: settings.title || "Foyer",
        icons: proxiedIcons(pwa["icons"]) || [
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
        shortcuts: pwa["shortcuts"],
        theme_color: getThemeColor(color, theme),
        background_color: getThemeColor(color, theme),
        display: "standalone",
        start_url: settings.startUrl || "/",
    };

    return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json" } });
}

export const GET = withRouteAuth(getResponse);
