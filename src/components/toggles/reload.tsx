import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import { MdRefresh } from "react-icons/md";

import apiFetch from "@/utils/api-fetch";
import { clearPersistedCache } from "@/utils/swr-cache";

type ReloadResponse = { reloaded?: boolean; error?: string };

// Asks the server to read the config file again. A broken config keeps the loaded one and is reported in a popup.
export default function Reload() {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    const reload = async () => {
        setBusy(true);
        try {
            const result = await apiFetch<ReloadResponse>("/api/reload", { method: "POST" });
            if (result.reloaded) {
                // widget data saved in this browser came from the old config
                try {
                    clearPersistedCache(window.localStorage);
                } catch {
                    // storage is blocked, so nothing was saved
                }
                window.location.reload();
                return;
            }
            setProblem(result.error ?? t("reload.failed"));
        } catch {
            setProblem(t("reload.failed"));
        }
        setBusy(false);
    };

    return (
        <>
            <div id="reload" className="rounded-full flex align-middle self-center mr-3">
                <button type="button" onClick={reload} disabled={busy} className="outline-hidden">
                    <MdRefresh
                        className={`text-theme-800 dark:text-theme-200 w-6 h-6 cursor-pointer${busy ? " animate-spin" : ""}`}
                        aria-hidden="true"
                    />
                    <span className="sr-only">{t("reload.reload")}</span>
                </button>
            </div>
            {problem !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="reload-title"
                        className="max-w-lg w-full rounded-md bg-theme-100 dark:bg-theme-900 text-theme-800 dark:text-theme-200 p-6 shadow-lg"
                    >
                        <h2 id="reload-title" className="font-bold text-lg mb-2">
                            {t("reload.brokenTitle")}
                        </h2>
                        <p className="mb-2">{t("reload.brokenMessage")}</p>
                        <pre className="text-sm opacity-70 whitespace-pre-wrap break-words mb-4">{problem}</pre>
                        <button
                            type="button"
                            onClick={() => setProblem(null)}
                            className="rounded-md px-3 py-1 bg-theme-300 dark:bg-theme-700"
                        >
                            {t("reload.close")}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
