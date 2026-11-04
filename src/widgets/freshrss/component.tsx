import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { FreshRssSummary } from "@/widgets/freshrss/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: freshrssData, error: freshrssError } = useWidgetAPI<FreshRssSummary>(widget, "info");

    if (freshrssError) {
        return <Container service={service} error={freshrssError} />;
    }

    if (!freshrssData) {
        return (
            <Container service={service}>
                <Block label="freshrss.unread" />
                <Block label="freshrss.subscriptions" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="freshrss.unread" value={t("common.number", { value: freshrssData.unread })} />
            <Block label="freshrss.subscriptions" value={t("common.number", { value: freshrssData.subscriptions })} />
        </Container>
    );
}
