import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { DockhandEnvironment, DockhandOptions, DockhandStats } from "@/widgets/dockhand/types";

const DEFAULT_FIELDS = ["running", "total", "cpu", "memory"];

export default function Component({ service: configuredService }: WidgetProps<DockhandOptions>) {
    const { t } = useTranslation();
    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;

    const { data: stats, error: statsError } = useWidgetAPI<DockhandStats>(widget, "dashboard/stats");

    if (statsError) {
        return <Container service={service} error={statsError} />;
    }

    if (!stats) {
        return (
            <Container service={service}>
                <Block label="dockhand.running" />
                <Block label="dockhand.total" />
                <Block label="dockhand.stopped" />
                <Block label="dockhand.paused" />
                <Block label="dockhand.pending_updates" />
                <Block label="dockhand.cpu" />
                <Block label="dockhand.memory" />
                <Block label="dockhand.images" />
                <Block label="dockhand.volumes" />
                <Block label="dockhand.stacks" />
                <Block label="dockhand.events_today" />
            </Container>
        );
    }

    let running: number | undefined;
    let stopped: number | undefined;
    let paused: number | undefined;
    let totalContainers: number | undefined;
    let pendingUpdates: number | undefined;
    let cpuPercent: number | undefined;
    let memoryPercent: number | undefined;
    let imagesTotal: number | undefined;
    let volumesTotal: number | undefined;
    let stacksRunning: number | undefined;
    let stacksTotal: number | undefined;
    let eventsToday: number | undefined;

    const configuredEnvironment = configuredService.widget.environment;

    if (configuredEnvironment) {
        const environment = stats.find(
            (env: DockhandEnvironment) =>
                env?.name?.toString().toLowerCase() === configuredEnvironment.toString().toLowerCase() ||
                env?.id?.toString() === configuredEnvironment.toString()
        );
        if (environment) {
            running = environment?.containers?.running;
            stopped = environment?.containers?.stopped ?? (environment?.containers?.total ?? 0) - (running ?? 0);
            paused = environment?.containers?.paused;
            pendingUpdates = environment?.containers?.pendingUpdates;
            totalContainers = environment?.containers?.total;
            cpuPercent = environment?.metrics?.cpuPercent;
            memoryPercent = environment?.metrics?.memoryPercent;
            imagesTotal = environment?.images?.total;
            volumesTotal = environment?.volumes?.total;
            stacksRunning = environment?.stacks?.running;
            stacksTotal = environment?.stacks?.total;
            eventsToday = environment?.events?.today;
        } else {
            return (
                <Container
                    service={service}
                    error={t("dockhand.environment_not_found", { environment: configuredEnvironment })}
                />
            );
        }
    }

    if (running === undefined) {
        // Aggregate across all environments
        running = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.containers?.running ?? 0), 0);
        totalContainers = stats.reduce(
            (sum: number, env: DockhandEnvironment) => sum + (env?.containers?.total ?? 0),
            0
        );
        stopped = totalContainers - running;
        paused = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.containers?.paused ?? 0), 0);
        pendingUpdates = stats.reduce(
            (sum: number, env: DockhandEnvironment) => sum + (env?.containers?.pendingUpdates ?? 0),
            0
        );
        const totalCpu = stats.reduce(
            (sum: number, env: DockhandEnvironment) => sum + (env?.metrics?.cpuPercent ?? 0),
            0
        );
        const totalMemory = stats.reduce(
            (sum: number, env: DockhandEnvironment) => sum + (env?.metrics?.memoryPercent ?? 0),
            0
        );
        const envCount = stats.length;
        cpuPercent = envCount > 0 ? totalCpu / envCount : 0;
        memoryPercent = envCount > 0 ? totalMemory / envCount : 0;
        imagesTotal = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.images?.total ?? 0), 0);
        volumesTotal = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.volumes?.total ?? 0), 0);
        stacksRunning = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.stacks?.running ?? 0), 0);
        stacksTotal = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.stacks?.total ?? 0), 0);
        eventsToday = stats.reduce((sum: number, env: DockhandEnvironment) => sum + (env?.events?.today ?? 0), 0);
    }

    return (
        <Container service={service}>
            <Block label="dockhand.running" value={t("common.number", { value: running })} />
            <Block label="dockhand.stopped" value={t("common.number", { value: stopped })} />
            <Block label="dockhand.paused" value={t("common.number", { value: paused ?? 0 })} />
            <Block label="dockhand.pending_updates" value={t("common.number", { value: pendingUpdates ?? 0 })} />
            <Block label="dockhand.total" value={t("common.number", { value: totalContainers })} />
            <Block
                label="dockhand.cpu"
                value={t("common.percent", { value: cpuPercent, maximumFractionDigits: 1 })}
                highlightValue={cpuPercent}
            />
            <Block
                label="dockhand.memory"
                value={t("common.percent", { value: memoryPercent, maximumFractionDigits: 1 })}
                highlightValue={memoryPercent}
            />
            <Block label="dockhand.images" value={t("common.number", { value: imagesTotal ?? 0 })} />
            <Block label="dockhand.volumes" value={t("common.number", { value: volumesTotal ?? 0 })} />
            <Block
                label="dockhand.stacks"
                value={
                    stacksRunning != null && stacksTotal != null
                        ? `${stacksRunning} / ${stacksTotal}`
                        : t("common.number", { value: stacksRunning ?? stacksTotal ?? 0 })
                }
            />
            <Block label="dockhand.events_today" value={t("common.number", { value: eventsToday ?? 0 })} />
        </Container>
    );
}
