import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { NzbgetStatus } from "@/widgets/nzbget/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation("common");

    const { widget } = service;

    const { data: statusData, error: statusError } = useWidgetAPI<NzbgetStatus>(widget, "status");

    if (statusError) {
        return <Container service={service} error={statusError} />;
    }

    if (!statusData) {
        return (
            <Container service={service}>
                <Block label="nzbget.rate" />
                <Block label="nzbget.remaining" />
                <Block label="nzbget.downloaded" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="nzbget.rate"
                value={t("common.byterate", { value: statusData.DownloadRate })}
                highlightValue={statusData.DownloadRate}
            />
            <Block
                label="nzbget.remaining"
                value={t("common.bytes", { value: statusData.RemainingSizeMB * 1024 * 1024 })}
                highlightValue={statusData.RemainingSizeMB * 1024 * 1024}
            />
            <Block
                label="nzbget.downloaded"
                value={t("common.bytes", { value: statusData.DownloadedSizeMB * 1024 * 1024 })}
                highlightValue={statusData.DownloadedSizeMB * 1024 * 1024}
            />
        </Container>
    );
}
