import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MinifluxCounters } from "@/widgets/miniflux/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: minifluxData, error: minifluxError } = useWidgetAPI<MinifluxCounters>(widget, "counters");

    if (minifluxError) {
        return <Container service={service} error={minifluxError} />;
    }

    if (!minifluxData) {
        return (
            <Container service={service}>
                <Block label="miniflux.unread" />
                <Block label="miniflux.read" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="miniflux.unread" value={t("common.number", { value: minifluxData.unread })} />
            <Block label="miniflux.read" value={t("common.number", { value: minifluxData.read })} />
        </Container>
    );
}
