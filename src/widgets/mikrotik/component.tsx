import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MikrotikSystem } from "@/widgets/mikrotik/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: statsData, error: statsError } = useWidgetAPI<MikrotikSystem>(widget, "system");
    const { data: leasesData, error: leasesError } = useWidgetAPI<unknown[]>(widget, "leases");

    if (statsError || leasesError) {
        const finalError = statsError ?? leasesError;
        return <Container service={service} error={finalError} />;
    }

    if (!statsData || !leasesData) {
        return (
            <Container service={service}>
                <Block label="mikrotik.uptime" />
                <Block label="mikrotik.cpuLoad" />
                <Block label="mikrotik.memoryUsed" />
                <Block label="mikrotik.numberOfLeases" />
            </Container>
        );
    }

    const memoryUsed = 100 - (statsData["free-memory"] / statsData["total-memory"]) * 100;

    const numberOfLeases = leasesData.length;

    return (
        <Container service={service}>
            <Block label="mikrotik.uptime" value={statsData.uptime} />
            <Block
                label="mikrotik.cpuLoad"
                value={t("common.percent", { value: statsData["cpu-load"] })}
                highlightValue={statsData["cpu-load"]}
            />
            <Block
                label="mikrotik.memoryUsed"
                value={t("common.percent", { value: memoryUsed })}
                highlightValue={memoryUsed}
            />
            <Block label="mikrotik.numberOfLeases" value={t("common.number", { value: numberOfLeases })} />
        </Container>
    );
}
