import { useTranslation } from "next-i18next/pages";
import { FaThermometerHalf } from "react-icons/fa";
import useSWR from "swr";

import type { CpuTempData } from "@/components/widgets/resources/types";
import Error from "@/components/widgets/widget/error";
import Resource from "@/components/widgets/widget/resource";

function convertToFahrenheit(t: number) {
    return (t * 9) / 5 + 32;
}

type CpuTempProps = {
    expanded?: boolean;
    units?: string;
    refresh?: number;
    tempmin?: number;
    tempmax?: number;
};

export default function CpuTemp({ expanded, units, refresh = 1500, tempmin = 0, tempmax = -1 }: CpuTempProps) {
    const { t } = useTranslation();

    const { data, error } = useSWR<CpuTempData>(`/api/widgets/resources?type=cputemp`, {
        refreshInterval: refresh,
    });

    if (error || data?.error) {
        return <Error />;
    }

    if (!data || !data.cputemp) {
        return (
            <Resource
                icon={FaThermometerHalf}
                value="-"
                label={t("resources.temp")}
                expandedValue="-"
                expandedLabel={t("resources.max")}
                expanded={expanded}
            />
        );
    }

    let mainTemp = data.cputemp.main;
    if (data.cputemp.cores?.length) {
        mainTemp = data.cputemp.cores.reduce((a, b) => a + b) / data.cputemp.cores.length;
    }
    const unit = units === "imperial" ? "fahrenheit" : "celsius";
    mainTemp = unit === "celsius" ? mainTemp : convertToFahrenheit(mainTemp);

    const minTemp = tempmin < mainTemp ? tempmin : mainTemp;
    let maxTemp = tempmax;
    if (maxTemp < minTemp) {
        maxTemp = unit === "celsius" ? data.cputemp.max : convertToFahrenheit(data.cputemp.max);
    }

    return (
        <Resource
            icon={FaThermometerHalf}
            value={t("common.number", {
                value: mainTemp,
                maximumFractionDigits: 1,
                style: "unit",
                unit,
            })}
            label={t("resources.temp")}
            expandedValue={t("common.number", {
                value: maxTemp,
                maximumFractionDigits: 1,
                style: "unit",
                unit,
            })}
            expandedLabel={t("resources.max")}
            percentage={Math.round(((mainTemp - minTemp) / (maxTemp - minTemp)) * 100)}
            expanded={expanded}
        />
    );
}
