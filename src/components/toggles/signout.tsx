import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "next-i18next/pages";
import { MdLogout } from "react-icons/md";

import { clearPersistedCache } from "@/utils/swr-cache";

function handleSignOut() {
    // the widget data saved in this browser belongs to the signed-in session
    try {
        clearPersistedCache(window.localStorage);
    } catch {
        // storage is blocked, so nothing was saved
    }
    return signOut({ callbackUrl: "/auth/signin?autologin=0" });
}

export default function SignOut() {
    const { t } = useTranslation();
    const { status } = useSession();

    if (status !== "authenticated") {
        return null;
    }

    return (
        <div id="signout" className="rounded-full flex align-middle self-center mr-3">
            <button type="button" onClick={handleSignOut} className="outline-hidden">
                <MdLogout className="text-theme-800 dark:text-theme-200 w-6 h-6 cursor-pointer" aria-hidden="true" />
                <span className="sr-only">{t("auth.signout")}</span>
            </button>
        </div>
    );
}
