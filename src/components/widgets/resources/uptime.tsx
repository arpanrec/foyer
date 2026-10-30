import { useTranslation } from "next-i18next/pages";
import { FaRegClock } from "react-icons/fa";
import useSWR from "swr";

import type { UptimeData } from "@/components/widgets/resources/types";
import Error from "@/components/widgets/widget/error";
import Resource from "@/components/widgets/widget/resource";

type UptimeProps = {
    refresh?: number;
};

export default function Uptime({ refresh = 1500 }: UptimeProps) {
    const { t } = useTranslation();

    const { data, error } = useSWR<UptimeData>(`/api/widgets/resources?type=uptime`, {
        refreshInterval: refresh,
    });

    if (error || data?.error) {
        return <Error />;
    }

    if (!data) {
        return <Resource icon={FaRegClock} value="-" label={t("resources.uptime")} percentage="0" />;
    }

    // oxlint-disable-next-line react/purity -- the current time is read on every render
    const percent = Math.round((new Date().getSeconds() / 60) * 100).toString();

    return (
        <Resource
            icon={FaRegClock}
            value={t("common.duration", { value: data.uptime })}
            label={t("resources.uptime")}
            percentage={percent}
        />
    );
}
