import { getSettings } from "@/utils/config/config";
import { getEnv } from "@/utils/env";
import { errorMessage } from "@/utils/error";

const PUBLIC_SIGN_IN_SETTINGS = ["theme", "color", "title", "background", "backgroundOpacity"];

// Everything returned here is serialized into a page anonymous visitors can load
export async function getSignInProps() {
    // Avoid getProviders() fetch
    let providers = {};
    try {
        // Dynamic so a bad config throws in here rather than at page load
        const { authOptions } = await import("@/app/api/auth/[...nextauth]/handler");
        providers = Object.fromEntries(authOptions.providers.map(({ id, name, type }) => [id, { id, name, type }]));
    } catch (e) {
        console.error("Unable to load auth providers: %s", errorMessage(e));
    }

    const foyerSettings = getSettings();
    const settings = Object.fromEntries(
        PUBLIC_SIGN_IN_SETTINGS.filter((key) => Object.prototype.hasOwnProperty.call(foyerSettings, key)).map((key) => [
            key,
            foyerSettings[key],
        ])
    );
    return { providers, settings, autoLogin: getEnv("OIDC_AUTO_LOGIN") === "true" };
}
