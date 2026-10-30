import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { RommStats } from "@/widgets/romm/types";

const ROMM_DEFAULT_FIELDS = ["platforms", "totalRoms", "saves", "states"];

export default function Component({ service: configuredService }: WidgetProps) {
    const service = withWidgetFields(configuredService, ROMM_DEFAULT_FIELDS);
    const { widget } = service;
    const { t } = useTranslation();
    const { data: response, error: responseError } = useWidgetAPI<RommStats>(widget, "statistics");

    if (responseError) {
        return <Container service={service} error={responseError} />;
    }

    if (!response) {
        return (
            <Container service={service}>
                <Block label="romm.platforms" />
                <Block label="romm.totalRoms" />
                <Block label="romm.saves" />
                <Block label="romm.states" />
                <Block label="romm.screenshots" />
                <Block label="romm.totalfilesize" />
            </Container>
        );
    }

    if (response) {
        return (
            <Container service={service}>
                <Block label="romm.platforms" value={t("common.number", { value: response.PLATFORMS })} />
                <Block label="romm.totalRoms" value={t("common.number", { value: response.ROMS })} />
                <Block label="romm.saves" value={t("common.number", { value: response.SAVES })} />
                <Block label="romm.states" value={t("common.number", { value: response.STATES })} />
                <Block label="romm.screenshots" value={t("common.number", { value: response.SCREENSHOTS })} />
                <Block
                    label="romm.totalfilesize"
                    value={t("common.bytes", { value: response.FILESIZE ?? response.TOTAL_FILESIZE_BYTES })}
                />
            </Container>
        );
    }
}
