"use client";

import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";

type SpinnerProps = {
    size?: "sm" | "lg" | undefined;
    className?: string | undefined;
};

const sizes = { sm: "w-8 h-8", lg: "w-24 h-24" };

export function Spinner({ size = "sm", className }: SpinnerProps) {
    const { t } = useTranslation();

    return (
        <div
            role="status"
            aria-label={t("loading.label")}
            className={classNames(
                "border-2 border-theme-400 border-solid rounded-full animate-spin border-t-transparent",
                sizes[size],
                className
            )}
        />
    );
}

export function LoadingScreen() {
    return (
        <div className="flex items-center justify-center h-screen">
            <Spinner size="lg" />
        </div>
    );
}
