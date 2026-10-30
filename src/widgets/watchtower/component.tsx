import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { WatchtowerMetrics } from "@/widgets/watchtower/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: watchData, error: watchError } = useWidgetAPI<WatchtowerMetrics>(widget, "watchtower");

    if (watchError) {
        return <Container service={service} error={watchError} />;
    }

    if (!watchData) {
        return (
            <Container service={service}>
                <Block label="watchtower.containers_scanned" />
                <Block label="watchtower.containers_updated" />
                <Block label="watchtower.containers_failed" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="watchtower.containers_scanned"
                value={t("common.number", { value: watchData.watchtower_containers_scanned })}
            />
            <Block
                label="watchtower.containers_updated"
                value={t("common.number", { value: watchData.watchtower_containers_updated })}
            />
            <Block
                label="watchtower.containers_failed"
                value={t("common.number", { value: watchData.watchtower_containers_failed })}
            />
        </Container>
    );
}
