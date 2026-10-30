import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { CheckmkProblems } from "@/widgets/checkmk/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: servicesData, error: servicesError } = useWidgetAPI<CheckmkProblems>(widget, "services_info", {
        columns: "state",
        query: '{"op": "!=", "left": "state", "right": "0"}',
    });
    const { data: hostsData, error: hostsError } = useWidgetAPI<CheckmkProblems>(widget, "hosts_info", {
        columns: "state",
        query: '{"op": "!=", "left": "state", "right": "0"}',
    });

    if (servicesError || hostsError) {
        return <Container service={service} error={servicesError ?? hostsError} />;
    }

    if (!servicesData || !hostsData) {
        return (
            <Container service={service}>
                <Block label="checkmk.serviceErrors" />
                <Block label="checkmk.hostErrors" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="checkmk.serviceErrors" value={t("common.number", { value: servicesData.value.length })} />
            <Block label="checkmk.hostErrors" value={t("common.number", { value: hostsData.value.length })} />
        </Container>
    );
}
