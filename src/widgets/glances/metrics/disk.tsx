import { useTranslation } from "next-i18next/pages";
import dynamic from "next/dynamic";
import { useCallback } from "react";

import { parseVersionForUrl } from "@/utils/proxy/api-helpers";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import Block from "@/widgets/glances/components/block";
import Container from "@/widgets/glances/components/container";
import useDataPoints from "@/widgets/glances/metrics/use-data-points";
import type { GlancesDiskDataPoint, GlancesDiskIo, GlancesMetricProps } from "@/widgets/glances/types";

const ChartDual = dynamic(() => import("@/widgets/glances/components/chart_dual"), { ssr: false });

const defaultPointsLimit = 15;
const defaultInterval = 1000;

export default function Component({ service }: GlancesMetricProps) {
    const { t } = useTranslation();
    const { widget } = service;
    const { chart, refreshInterval = defaultInterval, pointsLimit = defaultPointsLimit, version = 3 } = widget;
    const apiVersion = parseVersionForUrl(version, 3);
    const [, diskName] = (widget.metric ?? "").split(":");

    const [dataPoints, addDataPoint] = useDataPoints<GlancesDiskDataPoint>(pointsLimit, {
        read_bytes: 0,
        write_bytes: 0,
        time_since_update: 0,
    });

    const handleData = useCallback(
        (newData: (GlancesDiskIo[] & { error?: unknown }) | undefined) => {
            if (newData && !newData.error) {
                const diskData = newData.find((item) => item.disk_name === diskName);
                if (diskData) addDataPoint(diskData);
            }
        },
        [addDataPoint, diskName]
    );

    const { data, error } = useWidgetAPI<GlancesDiskIo[]>(
        service.widget,
        `${apiVersion}/diskio`,
        {
            refreshInterval: Math.max(defaultInterval, refreshInterval),
        },
        { onSuccess: handleData }
    );

    const calculateRates = (d: GlancesDiskDataPoint[]) =>
        d.map((item) => ({
            a: item.read_bytes / item.time_since_update,
            b: item.write_bytes / item.time_since_update,
        }));

    if (error || (data && data.error)) {
        const finalError = error || data?.error;
        return <Container error={finalError} widget={widget} />;
    }

    if (!data) {
        return (
            <Container chart={chart}>
                <Block position="bottom-3 left-3">-</Block>
            </Container>
        );
    }

    const diskData = data.find((item) => item.disk_name === diskName);

    if (!diskData) {
        return (
            <Container chart={chart}>
                <Block position="bottom-3 left-3">-</Block>
            </Container>
        );
    }

    const diskRates = calculateRates(dataPoints);
    const currentRate = diskRates[diskRates.length - 1];

    return (
        <Container chart={chart}>
            {chart && (
                <ChartDual
                    dataPoints={diskRates}
                    label={[t("glances.read"), t("glances.write")]}
                    max={diskData.critical}
                    formatter={(value) =>
                        t("common.bitrate", {
                            value,
                        })
                    }
                />
            )}

            {currentRate && !error && (
                <Block position={chart ? "bottom-3 left-3" : "bottom-3 right-3"}>
                    <div className="text-xs opacity-50 text-right">
                        {t("common.bitrate", {
                            value: currentRate.a,
                        })}{" "}
                        {t("glances.read")}
                    </div>
                    <div className="text-xs opacity-50 text-right">
                        {t("common.bitrate", {
                            value: currentRate.b,
                        })}{" "}
                        {t("glances.write")}
                    </div>
                </Block>
            )}

            <Block position={chart ? "bottom-3 right-3" : "bottom-3 left-3"}>
                <div className="text-xs opacity-75">
                    {t("common.bitrate", {
                        value: currentRate.a + currentRate.b,
                    })}
                </div>
            </Block>
        </Container>
    );
}
