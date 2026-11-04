import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import QueueEntry from "@/components/widgets/queue/queueEntry";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { SonarrOptions, SonarrQueueEntry, SonarrRecordCount, SonarrSeries } from "@/widgets/sonarr/types";

function getProgress(sizeLeft: number, size: number) {
    if (!Number.isFinite(size) || size <= 0) return 0;
    return Math.min(100, Math.max(0, (1 - sizeLeft / size) * 100));
}

function formatDownloadState(downloadState: string | undefined) {
    switch (downloadState) {
        case "importBlocked":
            return "import blocked";
        case "importPending":
            return "import pending";
        case "failedPending":
            return "failed pending";
        default:
            return downloadState;
    }
}

function getActivity(status: string | undefined, trackedDownloadState: string | undefined) {
    const completedStates: (string | undefined)[] = ["importBlocked", "importPending", "importing", "failedPending"];
    const downloadState =
        status === "completed" && completedStates.includes(trackedDownloadState)
            ? trackedDownloadState
            : (status ?? trackedDownloadState);

    return formatDownloadState(downloadState);
}

function getTitle(queueEntry: SonarrQueueEntry, seriesData: SonarrSeries[]) {
    let title = "";
    const seriesTitle = seriesData.find((entry) => entry.id === queueEntry.seriesId)?.title;
    if (seriesTitle) title += `${seriesTitle}: `;
    const { episodeTitle } = queueEntry;
    if (episodeTitle) title += episodeTitle;
    if (title === "") return null;
    return title;
}

export default function Component({ service }: WidgetProps<SonarrOptions>) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data: wantedData, error: wantedError } = useWidgetAPI<SonarrRecordCount>(widget, "wanted/missing");
    const { data: queuedData, error: queuedError } = useWidgetAPI<SonarrRecordCount>(widget, "queue");
    const { data: seriesData, error: seriesError } = useWidgetAPI<SonarrSeries[]>(widget, "series");
    const { data: queueDetailsData, error: queueDetailsError } = useWidgetAPI<SonarrQueueEntry[]>(
        widget,
        "queue/details"
    );

    if (wantedError || queuedError || seriesError || queueDetailsError) {
        const finalError = wantedError ?? queuedError ?? seriesError ?? queueDetailsError;
        return <Container service={service} error={finalError} />;
    }

    if (!wantedData || !queuedData || !seriesData || !queueDetailsData) {
        return (
            <Container service={service}>
                <Block label="sonarr.wanted" />
                <Block label="sonarr.queued" />
                <Block label="sonarr.series" />
            </Container>
        );
    }

    const enableQueue = widget?.enableQueue && Array.isArray(queueDetailsData) && queueDetailsData.length > 0;

    return (
        <>
            <Container service={service}>
                <Block label="sonarr.wanted" value={t("common.number", { value: wantedData.totalRecords })} />
                <Block label="sonarr.queued" value={t("common.number", { value: queuedData.totalRecords })} />
                <Block label="sonarr.series" value={t("common.number", { value: seriesData.length })} />
            </Container>
            {enableQueue &&
                queueDetailsData.map((queueEntry) => (
                    <QueueEntry
                        progress={getProgress(queueEntry.sizeLeft, queueEntry.size)}
                        timeLeft={queueEntry.timeLeft}
                        title={getTitle(queueEntry, seriesData) ?? t("sonarr.unknown")}
                        activity={getActivity(queueEntry.status, queueEntry.trackedDownloadState)}
                        key={`${queueEntry.seriesId}-${queueEntry.episodeId}`}
                    />
                ))}
        </>
    );
}
