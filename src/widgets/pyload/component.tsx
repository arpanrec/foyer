import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { PyloadStatusData } from "@/widgets/pyload/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { widget } = service;
    const { data: pyloadData, error: pyloadError } = useWidgetAPI<PyloadStatusData>(widget, "status");

    if (pyloadError) {
        return <Container service={service} error={pyloadError} />;
    }

    if (!pyloadData) {
        return (
            <Container service={service}>
                <Block label="pyload.speed" />
                <Block label="pyload.active" />
                <Block label="pyload.queue" />
                <Block label="pyload.total" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="pyload.speed"
                value={t("common.byterate", { value: pyloadData.speed })}
                highlightValue={pyloadData.speed}
            />
            <Block label="pyload.active" value={t("common.number", { value: pyloadData.active })} />
            <Block label="pyload.queue" value={t("common.number", { value: pyloadData.queue })} />
            <Block label="pyload.total" value={t("common.number", { value: pyloadData.total })} />
        </Container>
    );
}
