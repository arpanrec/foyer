import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import { useContext, useState } from "react";
import type { IconType } from "react-icons";
import { SiForgejo, SiGithub, SiGitlab } from "react-icons/si";

import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { Release, ReleasesData, ReleasesOptions } from "@/widgets/releases/types";

const rowClassName = "rounded-md bg-theme-200/50 dark:bg-theme-900/20 text-theme-700 dark:text-theme-200 text-xs";
const sourceIcons: Record<string, IconType> = { github: SiGithub, gitlab: SiGitlab, forgejo: SiForgejo };

function ReleaseItem({
    release,
    target,
    showSourceIcon,
}: {
    release: Release;
    target: string;
    showSourceIcon: boolean;
}) {
    const { t } = useTranslation();
    const SourceIcon = sourceIcons[release.source];

    return (
        <a
            href={release.url}
            target={target}
            rel="noopener noreferrer"
            className={classNames(
                rowClassName,
                "h-5 flex items-center gap-2 px-2 hover:bg-theme-300/50 dark:hover:bg-theme-800/20"
            )}
        >
            {showSourceIcon && SourceIcon && <SourceIcon className="w-3 h-3 shrink-0" title={release.source} />}
            <span className="grow truncate text-left">{release.name}</span>
            {(release.downvotes ?? 0) > 3 && (
                <span className="shrink-0 text-theme-500 dark:text-theme-400">
                    {t("common.number", { value: release.downvotes })} ⚠
                </span>
            )}
            <span className="shrink-0 font-medium">Latest: {release.version}</span>
            {release.date && (
                <span className="shrink-0 text-theme-500 dark:text-theme-400">
                    {t("common.relativeDate", {
                        value: release.date,
                        formatParams: { value: { style: "narrow", numeric: "auto" } },
                    })}
                </span>
            )}
        </a>
    );
}

export default function Component({ service }: WidgetProps<ReleasesOptions>) {
    const { t } = useTranslation();
    const { settings } = useContext(SettingsContext);
    const [expanded, setExpanded] = useState(false);
    const { widget } = service;

    const { data, error } = useWidgetAPI<ReleasesData>(widget, undefined, undefined, {
        refreshInterval: 10 * 60 * 1000,
    });

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <div className="w-full p-1 flex flex-col gap-1">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className={classNames(rowClassName, "h-5 animate-pulse")} />
                    ))}
                </div>
            </Container>
        );
    }

    const target = service.target ?? settings?.target ?? "_blank";
    const showSourceIcon = widget.showSourceIcon === true || widget.showSourceIcon === "true";
    const parsedCollapseAfter = parseInt(String(widget.collapseAfter), 10);
    // -1 never collapses
    const collapseAfter = parsedCollapseAfter === -1 || parsedCollapseAfter > 0 ? parsedCollapseAfter : 5;
    const canCollapse = collapseAfter !== -1 && data.releases.length > collapseAfter;
    const releases = canCollapse && !expanded ? data.releases.slice(0, collapseAfter) : data.releases;
    const failures = data.failures ?? [];

    return (
        <Container service={service}>
            <div className="w-full p-1 flex flex-col gap-1">
                {releases.map((release) => (
                    <ReleaseItem
                        key={`${release.source}:${release.name}:${release.version}`}
                        release={release}
                        target={target}
                        showSourceIcon={showSourceIcon}
                    />
                ))}
                {(canCollapse || data.failed > 0) && (
                    <div className="flex items-center justify-between px-2 text-xs text-theme-500 dark:text-theme-400">
                        <span
                            className={classNames(data.failed > 0 && "relative group text-red-600 dark:text-red-400")}
                        >
                            {data.failed > 0 && t("releases.failed", { count: data.failed })}
                            {failures.length > 0 && (
                                <div
                                    className={classNames(
                                        "hidden group-hover:flex flex-col gap-0.5 absolute bottom-full left-0 mb-1 z-10",
                                        "w-max max-w-72 rounded-md border border-yellow-500/50 px-2 py-1.5",
                                        "bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200"
                                    )}
                                >
                                    {failures.map(({ service: failedService, repo, reason }) => (
                                        <span key={`${failedService}:${repo}`} className="truncate text-left">
                                            {failedService}:{repo} — {reason}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </span>
                        {canCollapse && (
                            <button
                                type="button"
                                onClick={() => setExpanded(!expanded)}
                                className="uppercase hover:text-theme-700 dark:hover:text-theme-200"
                            >
                                {t(expanded ? "releases.showLess" : "releases.showMore")}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Container>
    );
}
