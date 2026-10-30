import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { KavitaStats } from "@/widgets/kavita/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: kavitaData, error: kavitaError } = useWidgetAPI<KavitaStats>(widget, "info");

    if (kavitaError) {
        return <Container service={service} error={kavitaError} />;
    }

    if (!kavitaData) {
        return (
            <Container service={service}>
                <Block label="kavita.seriesCount" />
                <Block label="kavita.totalFiles" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="kavita.seriesCount" value={t("common.number", { value: kavitaData.seriesCount })} />
            <Block label="kavita.totalFiles" value={t("common.number", { value: kavitaData.totalFiles })} />
        </Container>
    );
}
