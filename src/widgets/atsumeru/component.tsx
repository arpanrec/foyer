import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { AtsumeruInfo } from "@/widgets/atsumeru/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data: infoData, error: infoError } = useWidgetAPI<AtsumeruInfo>(widget, "info");

    if (infoError) {
        return <Container service={service} error={infoError} />;
    }

    if (!infoData) {
        return (
            <Container service={service}>
                <Block label="atsumeru.series" />
                <Block label="atsumeru.archives" />
                <Block label="atsumeru.chapters" />
                <Block label="atsumeru.categories" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="atsumeru.series" value={t("common.number", { value: infoData.stats.total_series })} />
            <Block label="atsumeru.archives" value={t("common.number", { value: infoData.stats.total_archives })} />
            <Block label="atsumeru.chapters" value={t("common.number", { value: infoData.stats.total_chapters })} />
            <Block label="atsumeru.categories" value={t("common.number", { value: infoData.stats.total_categories })} />
        </Container>
    );
}
