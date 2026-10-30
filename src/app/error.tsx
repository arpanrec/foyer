"use client";

import { useTranslation } from "next-i18next/pages";
import { useEffect } from "react";
import { BiError } from "react-icons/bi";

import { errorDigest, errorMessage } from "@/utils/error";

type ErrorBoundaryProps = {
    error: unknown;
    retry: () => void;
};

export default function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const { t } = useTranslation();
    const message = errorMessage(error);
    const digest = errorDigest(error);

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="w-full h-screen flex items-center justify-center p-10">
            <div className="max-w-md w-full rounded-md shadow-md font-mono">
                <div className="bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200 p-2 rounded-t-md font-bold flex items-center gap-2">
                    <BiError className="w-5 h-5 shrink-0" />
                    {t("errorBoundary.title")}
                </div>
                <div className="bg-rose-100 dark:bg-rose-900 text-rose-900 dark:text-rose-100 p-3 rounded-b-md flex flex-col gap-2">
                    {message && <p className="text-sm break-words">{message}</p>}
                    {digest && <p className="text-xs opacity-70">{t("errorBoundary.digest", { digest })}</p>}
                    <button
                        type="button"
                        onClick={() => retry()}
                        className="self-start rounded bg-rose-200 dark:bg-rose-800 px-3 py-1.5 text-sm font-sans font-medium hover:bg-rose-300 dark:hover:bg-rose-700"
                    >
                        {t("errorBoundary.retry")}
                    </button>
                </div>
            </div>
        </div>
    );
}
