import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { TriliumMetrics } from "@/widgets/trilium/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data: metricsData, error: metricsError } = useWidgetAPI<TriliumMetrics>(widget, "metrics");

    if (metricsError) {
        return <Container service={service} error={metricsError} />;
    }

    if (!metricsData) {
        return (
            <Container service={service}>
                <Block label="trilium.version" />
                <Block label="trilium.notesCount" />
                <Block label="trilium.dbSize" />
            </Container>
        );
    }

    const version = metricsData.version?.app;
    const notesCount = metricsData.database?.activeNotes || 0;
    const databaseSizeBytes = metricsData.statistics?.databaseSizeBytes || 0;

    return (
        <Container service={service}>
            <Block label="trilium.version" value={version ? `v${version}` : t("trilium.unknown")} />
            <Block label="trilium.notesCount" value={t("common.number", { value: notesCount })} />
            <Block label="trilium.dbSize" value={t("common.bytes", { value: databaseSizeBytes })} />
        </Container>
    );
}
