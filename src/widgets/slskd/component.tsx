import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { SlskdApplication, SlskdTransfers } from "@/widgets/slskd/types";

const slskdDefaultFields = ["slskStatus", "downloads", "uploads", "sharedFiles"];

export default function Component({ service: configuredService }: WidgetProps) {
    const { t } = useTranslation();
    const service = withWidgetFields(configuredService, slskdDefaultFields);
    const { widget } = service;

    const { data: appData, error: appError } = useWidgetAPI<SlskdApplication>(widget, "application");
    const { data: downData, error: downError } = useWidgetAPI<SlskdTransfers>(widget, "downloads");
    const { data: upData, error: upError } = useWidgetAPI<SlskdTransfers>(widget, "uploads");

    if (appError || downError || upError) {
        return <Container service={service} error={appError ?? downError ?? upError} />;
    }

    if (!appData || !downData || !upData) {
        return (
            <Container service={service}>
                <Block label="slskd.slskStatus" />
                <Block label="slskd.updateStatus" />
                <Block label="slskd.downloads" />
                <Block label="slskd.uploads" />
                <Block label="slskd.sharedFiles" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="slskd.slskStatus"
                value={appData.server?.isConnected ? t("slskd.connected") : t("slskd.disconnected")}
            />
            <Block
                label="slskd.updateStatus"
                value={appData.version?.isUpdateAvailable ? t("slskd.update_yes") : t("slskd.update_no")}
            />
            <Block label="slskd.downloads" value={t("common.number", { value: downData.length ?? 0 })} />
            <Block label="slskd.uploads" value={t("common.number", { value: upData.length ?? 0 })} />
            <Block label="slskd.sharedFiles" value={t("common.number", { value: appData.shares?.files ?? 0 })} />
        </Container>
    );
}
