import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { AutobrrStats } from "@/widgets/autobrr/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: statsData, error: statsError } = useWidgetAPI<AutobrrStats>(widget, "stats");
    const { data: filtersData, error: filtersError } = useWidgetAPI<unknown[]>(widget, "filters");
    const { data: indexersData, error: indexersError } = useWidgetAPI<unknown[]>(widget, "indexers");

    if (statsError || filtersError || indexersError) {
        const finalError = statsError ?? filtersError ?? indexersError;
        return <Container service={service} error={finalError} />;
    }

    if (!statsData || !filtersData || !indexersData) {
        return (
            <Container service={service}>
                <Block label="autobrr.approvedPushes" />
                <Block label="autobrr.rejectedPushes" />
                <Block label="autobrr.filters" />
                <Block label="autobrr.indexers" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="autobrr.approvedPushes"
                value={t("common.number", { value: statsData.push_approved_count })}
            />
            <Block
                label="autobrr.rejectedPushes"
                value={t("common.number", { value: statsData.push_rejected_count })}
            />
            <Block label="autobrr.filters" value={t("common.number", { value: filtersData.length })} />
            <Block label="autobrr.indexers" value={t("common.number", { value: indexersData.length })} />
        </Container>
    );
}
