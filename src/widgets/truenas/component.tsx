import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import Pool from "@/widgets/truenas/pool";
import type {
    TruenasAlerts,
    TruenasDataset,
    TruenasOptions,
    TruenasPool,
    TruenasStatus,
} from "@/widgets/truenas/types";

type PoolRow = TruenasPool & { allocated: number; free: number };

export default function Component({ service }: WidgetProps<TruenasOptions>) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: alertData, error: alertError } = useWidgetAPI<TruenasAlerts>(widget, "alerts");
    const { data: statusData, error: statusError } = useWidgetAPI<TruenasStatus>(widget, "status");
    const { data: poolsData, error: poolsError } = useWidgetAPI<TruenasPool[]>(
        widget,
        widget?.enablePools ? "pools" : ""
    );
    const { data: datasetData, error: datasetError } = useWidgetAPI<TruenasDataset[]>(
        widget,
        widget?.enablePools ? "dataset" : ""
    );

    if (alertError || statusError || poolsError) {
        const finalError = alertError ?? statusError ?? poolsError ?? datasetError;
        return <Container service={service} error={finalError} />;
    }

    if (!alertData || !statusData || (widget?.enablePools && (!poolsData || !datasetData))) {
        return (
            <Container service={service}>
                <Block label="truenas.load" />
                <Block label="truenas.uptime" />
                <Block label="truenas.alerts" />
            </Container>
        );
    }

    let pools: PoolRow[] = [];
    const showPools =
        Array.isArray(poolsData) && poolsData.length > 0 && Array.isArray(datasetData) && datasetData.length > 0;

    if (showPools) {
        pools = poolsData.map((pool) => {
            const dataset = datasetData.find((d) => d.pool === pool.name && d.name === pool.name);
            return {
                id: pool.id,
                name: pool.name,
                healthy: pool.healthy,
                allocated: dataset?.used?.parsed ?? 0,
                free: dataset?.available?.parsed ?? 0,
            };
        });
    }

    return (
        <>
            <Container service={service}>
                <Block label="truenas.load" value={t("common.number", { value: statusData.loadavg[0] })} />
                <Block label="truenas.uptime" value={t("common.duration", { value: statusData.uptime_seconds })} />
                <Block label="truenas.alerts" value={t("common.number", { value: alertData.pending })} />
            </Container>
            {showPools &&
                pools
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((pool) => (
                        <Pool
                            key={pool.id}
                            name={pool.name}
                            healthy={pool.healthy}
                            allocated={pool.allocated}
                            free={pool.free}
                        />
                    ))}
        </>
    );
}
