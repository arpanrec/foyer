import { useTranslation } from "next-i18next/pages";
import { IoAlertCircle } from "react-icons/io5";

import type { Service } from "@/types/service";

// What a failed widget call reports; the services proxy fills in whichever of these it has
type WidgetError = {
    message?: string;
    url?: string;
    rawError?: unknown;
    data?: unknown;
};

function displayError(error: unknown) {
    const detail = (error as Record<number, unknown> | null | undefined)?.[1];
    return JSON.stringify(detail ? detail : error, null, 4);
}

function toWidgetError(error: unknown): WidgetError {
    if (typeof error === "string") return { message: error };
    if (typeof error === "number") return { message: `Error ${error}` };

    const nested = (error as { data?: { error?: WidgetError } } | null | undefined)?.data?.error;
    return nested ? nested : (error as WidgetError);
}

function displayData(data: unknown) {
    return (data as { type?: unknown }).type === "Buffer"
        ? Buffer.from(data as Uint8Array).toString()
        : JSON.stringify(data);
}

type ErrorProps = {
    error: unknown;
    service?: Service;
};

export default function Error({ error: rawError }: ErrorProps) {
    const { t } = useTranslation();
    const error = toWidgetError(rawError);

    return (
        <details className="px-1 pb-1">
            <summary className="block text-center mt-1 mb-0 mx-auto p-3 rounded-sm bg-rose-900/80 hover:bg-rose-900/95 text-theme-900 cursor-pointer">
                <div className="flex items-center justify-center text-xs font-bold">
                    <IoAlertCircle className="mr-1 w-5 h-5" />
                    {t("widget.api_error")} {error.message && t("widget.information")}
                </div>
            </summary>
            <div className="bg-white dark:bg-theme-200/50 mt-2 rounded-sm text-rose-900 text-xs font-mono whitespace-pre-wrap break-all">
                <ul className="p-4">
                    {error.message && (
                        <li>
                            <span className="text-black">{t("widget.api_error")}:</span> {error.message}
                        </li>
                    )}
                    {error.url && (
                        <li className="mt-2">
                            <span className="text-black">{t("widget.url")}:</span> {error.url}
                        </li>
                    )}
                    {!!error.rawError && (
                        <li className="mt-2">
                            <span className="text-black">{t("widget.raw_error")}:</span>
                            <div className="ml-2">{displayError(error.rawError)}</div>
                        </li>
                    )}
                    {!!error.data && (
                        <li className="mt-2">
                            <span className="text-black">{t("widget.response_data")}:</span>
                            <div className="ml-2">{displayData(error.data)}</div>
                        </li>
                    )}
                </ul>
            </div>
        </details>
    );
}
