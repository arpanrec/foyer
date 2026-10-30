import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { NetalertxOptions, NetalertxTotals } from "@/widgets/netalertx/types";

export default function Component({ service }: WidgetProps<NetalertxOptions>) {
    const { t } = useTranslation();

    const { widget } = service;

    const dataEndpoint = (widget.version ?? 0) > 1 ? "datav2" : "data";

    const { data: netalertxData, error: netalertxError } = useWidgetAPI<NetalertxTotals>(widget, dataEndpoint);

    if (netalertxError) {
        return <Container service={service} error={netalertxError} />;
    }

    if (!netalertxData) {
        return (
            <Container service={service}>
                <Block label="netalertx.total" />
                <Block label="netalertx.connected" />
                <Block label="netalertx.new_devices" />
                <Block label="netalertx.down_alerts" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="netalertx.total" value={t("common.number", { value: parseInt(netalertxData[0], 10) })} />
            <Block label="netalertx.connected" value={t("common.number", { value: parseInt(netalertxData[1], 10) })} />
            <Block
                label="netalertx.new_devices"
                value={t("common.number", { value: parseInt(netalertxData[3], 10) })}
            />
            <Block
                label="netalertx.down_alerts"
                value={t("common.number", { value: parseInt(netalertxData[4], 10) })}
            />
        </Container>
    );
}
