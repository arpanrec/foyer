import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type {
    DiskStationInfo,
    DiskStationOptions,
    DiskStationStorage,
    DiskStationUtilization,
    DiskStationVolume,
} from "@/widgets/diskstation/types";

export default function Component({ service }: WidgetProps<DiskStationOptions>) {
    const { t } = useTranslation();
    const { widget } = service;
    const { data: infoData, error: infoError } = useWidgetAPI<DiskStationInfo>(widget, "system_info");
    const { data: storageData, error: storageError } = useWidgetAPI<DiskStationStorage>(widget, "system_storage");
    const { data: utilizationData, error: utilizationError } = useWidgetAPI<DiskStationUtilization>(
        widget,
        "utilization"
    );

    if (storageError || infoError || utilizationError) {
        return <Container service={service} error={storageError ?? infoError ?? utilizationError} />;
    }

    if (!storageData || !infoData || !utilizationData) {
        return (
            <Container service={service}>
                <Block label="diskstation.uptime" />
                <Block label="diskstation.volumeAvailable" />
                <Block label="resources.cpu" />
                <Block label="resources.mem" />
            </Container>
        );
    }

    // uptime info
    const [hour] = infoData.data.up_time.split(":");
    const days = Math.floor(Number(hour) / 24);
    const uptime = `${t("common.number", { value: days })} ${t("diskstation.days")}`;

    // storage info
    const volume = widget.volume
        ? storageData.data.vol_info?.find((vol: DiskStationVolume) => vol.name === widget.volume)
        : storageData.data.vol_info?.[0];
    const usedBytes = parseFloat(volume?.used_size ?? "");
    const totalBytes = parseFloat(volume?.total_size ?? "");
    const freeBytes = totalBytes - usedBytes;

    // utilization info
    const { cpu, memory } = utilizationData.data;
    const cpuLoad = parseFloat(cpu.user_load) + parseFloat(cpu.system_load);
    const memoryUsage = memory.real_usage
        ? parseFloat(memory.real_usage)
        : 100 - (100 * (parseFloat(memory.avail_real) + parseFloat(memory.cached))) / parseFloat(memory.total_real);

    return (
        <Container service={service}>
            <Block label="diskstation.uptime" value={uptime} />
            <Block
                label="diskstation.volumeAvailable"
                value={t("common.bbytes", { value: freeBytes, maximumFractionDigits: 1 })}
            />
            <Block label="resources.cpu" value={t("common.percent", { value: cpuLoad })} />
            <Block label="resources.mem" value={t("common.percent", { value: memoryUsage })} />
        </Container>
    );
}
