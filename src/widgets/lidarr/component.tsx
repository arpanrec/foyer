import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { LidarrQueueStatus, LidarrWanted } from "@/widgets/lidarr/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: artistsData, error: artistsError } = useWidgetAPI<unknown[]>(widget, "artist");
    const { data: wantedData, error: wantedError } = useWidgetAPI<LidarrWanted>(widget, "wanted/missing");
    const { data: queueData, error: queueError } = useWidgetAPI<LidarrQueueStatus>(widget, "queue/status");

    if (artistsError || wantedError || queueError) {
        const finalError = artistsError ?? wantedError ?? queueError;
        return <Container service={service} error={finalError} />;
    }

    if (!artistsData || !wantedData || !queueData) {
        return (
            <Container service={service}>
                <Block label="lidarr.wanted" />
                <Block label="lidarr.queued" />
                <Block label="lidarr.artists" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="lidarr.wanted" value={t("common.number", { value: wantedData.totalRecords })} />
            <Block label="lidarr.queued" value={t("common.number", { value: queueData.totalCount })} />
            <Block label="lidarr.artists" value={t("common.number", { value: artistsData.length })} />
        </Container>
    );
}
