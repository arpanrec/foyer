import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { JdownloaderSummary } from "@/widgets/jdownloader/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: jdownloaderData, error: jdownloaderAPIError } = useWidgetAPI<JdownloaderSummary>(widget, "unified", {
        refreshInterval: 30000,
    });

    if (jdownloaderAPIError) {
        return <Container service={service} error={jdownloaderAPIError} />;
    }

    if (!jdownloaderData) {
        return (
            <Container service={service}>
                <Block label="jdownloader.downloadCount" />
                <Block label="jdownloader.downloadTotalBytes" />
                <Block label="jdownloader.downloadBytesRemaining" />
                <Block label="jdownloader.downloadSpeed" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="jdownloader.downloadCount"
                value={t("common.number", { value: jdownloaderData.downloadCount })}
            />
            <Block
                label="jdownloader.downloadTotalBytes"
                value={t("common.bytes", { value: jdownloaderData.totalBytes })}
                highlightValue={jdownloaderData.totalBytes}
            />
            <Block
                label="jdownloader.downloadBytesRemaining"
                value={t("common.bytes", { value: jdownloaderData.bytesRemaining })}
                highlightValue={jdownloaderData.bytesRemaining}
            />
            <Block
                label="jdownloader.downloadSpeed"
                value={t("common.byterate", { value: jdownloaderData.totalSpeed })}
                highlightValue={jdownloaderData.totalSpeed}
            />
        </Container>
    );
}
