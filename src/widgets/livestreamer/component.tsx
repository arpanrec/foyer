/* eslint-disable @next/next/no-img-element */
import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import { useContext, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { SiTwitch } from "react-icons/si";

import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { LiveStreamerChannel, LiveStreamerData, LiveStreamerOptions } from "@/widgets/livestreamer/types";

const rowClassName = "rounded-md bg-theme-200/50 dark:bg-theme-900/20 text-theme-700 dark:text-theme-200 text-xs";

function toBool(value: unknown, defaultValue = false): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return defaultValue;
}

function PlatformIcon({ platform }: { platform: string }) {
    if (platform === "twitch") {
        return (
            <div className="w-8 h-8 rounded-full bg-theme-300/60 dark:bg-theme-800/60 flex items-center justify-center shrink-0 text-[#9146FF]">
                <SiTwitch className="w-4 h-4" />
            </div>
        );
    }
    return (
        <div className="w-8 h-8 rounded-full bg-theme-300/60 dark:bg-theme-800/60 flex items-center justify-center shrink-0 text-theme-500">
            <span className="text-xs uppercase font-bold">{platform.slice(0, 2)}</span>
        </div>
    );
}

function getTooltipPosition(x: number, y: number) {
    if (typeof window === "undefined") {
        return { left: x + 16, top: y + 16 };
    }
    const tooltipWidth = 280;
    const tooltipHeight = 220;

    let left = x + 16;
    let top = y + 16;

    if (left + tooltipWidth > window.innerWidth - 12) {
        left = Math.max(12, x - tooltipWidth - 16);
    }

    if (top + tooltipHeight > window.innerHeight - 12) {
        top = Math.max(12, y - tooltipHeight - 16);
    }

    return { left, top };
}

function ChannelItem({
    channel,
    target,
    showPreview,
}: {
    channel: LiveStreamerChannel;
    target: string;
    showPreview: boolean;
}) {
    const { t } = useTranslation();
    const [imgError, setImgError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [previewError, setPreviewError] = useState(false);

    const href = channel.exists ? channel.url : undefined;

    const handleMouseEnter = (e: MouseEvent) => {
        if (channel.isLive) {
            setMousePos({ x: e.clientX, y: e.clientY });
            setIsHovered(true);
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (channel.isLive) {
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const content = (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={classNames(
                rowClassName,
                "group relative flex items-center gap-2.5 p-1.5 transition-colors",
                href && "hover:bg-theme-300/50 dark:hover:bg-theme-800/20 cursor-pointer"
            )}
        >
            {/* Avatar Container */}
            <div className="relative shrink-0">
                {channel.avatarUrl && !imgError ? (
                    <img
                        src={channel.avatarUrl}
                        alt={channel.name}
                        onError={() => setImgError(true)}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                        loading="lazy"
                    />
                ) : (
                    <PlatformIcon platform={channel.platform} />
                )}

                {channel.isLive && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                )}
            </div>

            {/* Info Container */}
            <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
                {/* Top row: Name + Live badge / viewer count or status */}
                <div className="flex items-center gap-1.5 leading-tight">
                    <span
                        className={classNames(
                            "font-medium truncate",
                            channel.isLive && "text-theme-900 dark:text-theme-100"
                        )}
                    >
                        {channel.name}
                    </span>

                    {channel.isLive ? (
                        <>
                            <span className="shrink-0 px-1 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-500 dark:text-red-400 uppercase tracking-wider">
                                {t("livestreamer.live")}
                            </span>
                            <span className="ml-auto shrink-0 text-[11px] text-theme-500 dark:text-theme-400">
                                {t("common.number", { value: channel.viewersCount })} {t("livestreamer.viewers")}
                            </span>
                        </>
                    ) : channel.exists ? (
                        <span className="ml-auto shrink-0 text-[11px] text-theme-500 dark:text-theme-400">
                            {t("livestreamer.offline")}
                        </span>
                    ) : (
                        <span className="ml-auto shrink-0 text-[11px] text-red-500 dark:text-red-400">
                            {t("livestreamer.notFound")}
                        </span>
                    )}
                </div>

                {/* Bottom row: Game / stream title or channel url display */}
                {channel.isLive ? (
                    <div className="flex items-center gap-1 text-[11px] text-theme-500 dark:text-theme-400 truncate leading-tight mt-0.5">
                        {channel.game && (
                            <span className="font-semibold text-theme-600 dark:text-theme-300 truncate shrink-0 max-w-[40%]">
                                {channel.game}
                            </span>
                        )}
                        {channel.game && channel.streamTitle && <span>•</span>}
                        {channel.streamTitle && <span className="truncate">{channel.streamTitle}</span>}
                    </div>
                ) : (
                    <div className="text-[11px] text-theme-400 dark:text-theme-500 truncate leading-tight mt-0.5">
                        {channel.url ? channel.url.replace(/^https?:\/\//, "") : `${channel.platform}:${channel.login}`}
                    </div>
                )}
            </div>
        </div>
    );

    const tooltip =
        isHovered &&
        typeof document !== "undefined" &&
        channel.isLive &&
        (channel.game || channel.streamTitle || (showPreview && channel.previewUrl))
            ? createPortal(
                  <div
                      style={{
                          position: "fixed",
                          left: getTooltipPosition(mousePos.x, mousePos.y).left,
                          top: getTooltipPosition(mousePos.x, mousePos.y).top,
                          zIndex: 9999,
                          pointerEvents: "none",
                      }}
                      className="w-72 max-w-xs rounded-md shadow-2xl border border-theme-300/50 dark:border-theme-800 bg-theme-100 dark:bg-theme-900 p-2 text-xs pointer-events-none"
                  >
                      {showPreview && channel.previewUrl && !previewError && (
                          <img
                              src={channel.previewUrl}
                              alt=""
                              onError={() => setPreviewError(true)}
                              className="w-full aspect-video object-cover rounded mb-1.5"
                              loading="lazy"
                          />
                      )}

                      {channel.game && (
                          <div className="font-semibold text-theme-800 dark:text-theme-100 mb-0.5 truncate">
                              {channel.game}
                          </div>
                      )}

                      {channel.streamTitle && (
                          <p className="text-[11px] text-theme-600 dark:text-theme-300 leading-snug break-words">
                              {channel.streamTitle}
                          </p>
                      )}
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            {href ? (
                <a href={href} target={target} rel="noopener noreferrer" className="block text-inherit no-underline">
                    {content}
                </a>
            ) : (
                content
            )}
            {tooltip}
        </>
    );
}

export default function Component({ service }: WidgetProps<LiveStreamerOptions>) {
    const { t } = useTranslation();
    const { settings } = useContext(SettingsContext);
    const [expanded, setExpanded] = useState(false);
    const { widget } = service;

    const { data, error } = useWidgetAPI<LiveStreamerData>(widget, undefined, undefined, {
        refreshInterval: 60 * 1000,
    });

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <div className="w-full p-1 flex flex-col gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className={classNames(rowClassName, "h-11 animate-pulse")} />
                    ))}
                </div>
            </Container>
        );
    }

    const target = service.target ?? settings?.target ?? "_blank";
    const hideOffline = toBool(widget.hideOffline, false);
    const showPreview = toBool(widget.showPreview, true);

    const channels = hideOffline ? data.channels.filter((c) => c.isLive) : data.channels;

    const parsedCollapseAfter = parseInt(String(widget.collapseAfter), 10);
    const collapseAfter = parsedCollapseAfter === -1 || parsedCollapseAfter > 0 ? parsedCollapseAfter : 5;
    const canCollapse = collapseAfter !== -1 && channels.length > collapseAfter;
    const displayedChannels = canCollapse && !expanded ? channels.slice(0, collapseAfter) : channels;

    return (
        <Container service={service}>
            <div className="w-full p-1 flex flex-col gap-1.5">
                {displayedChannels.length === 0 ? (
                    <div className="text-center py-2 text-xs text-theme-500 dark:text-theme-400">
                        {t("livestreamer.noChannels")}
                    </div>
                ) : (
                    displayedChannels.map((channel) => (
                        <ChannelItem
                            key={`${channel.platform}:${channel.login}`}
                            channel={channel}
                            target={target}
                            showPreview={showPreview}
                        />
                    ))
                )}

                {canCollapse && (
                    <div className="flex items-center justify-end px-2 pt-1 text-xs text-theme-500 dark:text-theme-400">
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="uppercase hover:text-theme-700 dark:hover:text-theme-200"
                        >
                            {t(expanded ? "livestreamer.showLess" : "livestreamer.showMore")}
                        </button>
                    </div>
                )}
            </div>
        </Container>
    );
}
