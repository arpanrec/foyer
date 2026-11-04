import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { DevelanCacheUiStats } from "@/widgets/develancacheui/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: downloadStatsData, error: downloadStatsError } = useWidgetAPI<DevelanCacheUiStats>(widget, "stats");

    if (downloadStatsError) {
        return <Container service={service} error={downloadStatsError} />;
    }

    if (!downloadStatsData) {
        return (
            <Container service={service}>
                <Block label="develancacheui.cachehitbytes" />
                <Block label="develancacheui.cachemissbytes" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="develancacheui.cachehitbytes"
                value={t("common.bytes", { value: downloadStatsData.totalCacheHitBytes })}
            />
            <Block
                label="develancacheui.cachemissbytes"
                value={t("common.bytes", { value: downloadStatsData.totalCacheMissBytes })}
            />
        </Container>
    );
}
