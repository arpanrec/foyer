import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import { BiError } from "react-icons/bi";

import useDarkReader from "@/utils/hooks/dark-reader";

export default function DarkReaderBanner() {
    const { t } = useTranslation();
    const active = useDarkReader();
    const [dismissed, setDismissed] = useState(false);

    if (!active || dismissed) return null;

    return (
        <div
            role="alert"
            className="flex items-center gap-3 m-5 sm:mx-9 sm:mb-0 p-2 rounded-md font-bold bg-amber-200 text-amber-800 dark:text-amber-200 dark:bg-amber-800"
        >
            <BiError className="w-6 h-6 shrink-0" />
            <span className="grow">{t("darkReader.warning")}</span>
            <button type="button" className="underline shrink-0" onClick={() => setDismissed(true)}>
                {t("darkReader.dismiss")}
            </button>
        </div>
    );
}
