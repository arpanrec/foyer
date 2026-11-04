import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { NetdataInfo } from "@/widgets/netdata/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: netdataData, error: netdataError } = useWidgetAPI<NetdataInfo>(widget, "info");

    if (netdataError) {
        return <Container service={service} error={netdataError} />;
    }

    if (!netdataData) {
        return (
            <Container service={service}>
                <Block label="netdata.warnings" />
                <Block label="netdata.criticals" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="netdata.warnings" value={t("common.number", { value: netdataData.alarms.warning })} />
            <Block label="netdata.criticals" value={t("common.number", { value: netdataData.alarms.critical })} />
        </Container>
    );
}
