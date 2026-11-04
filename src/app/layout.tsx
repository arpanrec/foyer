import "@/styles/globals.css";
import "@/styles/manrope.css";
import "@/styles/plex-mono.css";
import "@/styles/theme.css";
import type { ReactNode } from "react";

import Providers from "@/app/providers";
import { getSettings } from "@/utils/config/settings";
import { getTranslations } from "@/utils/config/translations";

// Settings and translations come from the config file at runtime, never from the build
export const dynamic = "force-dynamic";

export const viewport = {
    width: "device-width",
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 1,
    userScalable: false,
};

async function readSettings() {
    try {
        return await getSettings();
    } catch {
        // The dashboard reports config errors through /api/validate
        return {};
    }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
    const settings = await readSettings();
    const { language, resources } = await getTranslations(settings.language);

    return (
        <html lang={language}>
            <head>
                <meta name="mobile-web-app-capable" content="yes" />
                {settings.base && <base href={settings.base} />}
                {/* oxlint-disable-next-line next/no-css-tags -- the CSS comes from the config's customCss member at request time, so it cannot be imported */}
                <link rel="stylesheet" href="/api/config/custom.css" />
            </head>
            <body>
                <Providers language={language} resources={resources}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
