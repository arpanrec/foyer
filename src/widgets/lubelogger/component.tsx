import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { LubeloggerOptions, LubeloggerVehicle } from "@/widgets/lubelogger/types";

export default function Component({ service }: WidgetProps<LubeloggerOptions>) {
    const { t } = useTranslation();
    const { widget } = service;
    const { data: allVehicles, error } = useWidgetAPI<LubeloggerVehicle[]>(widget, "vehicleinfo");

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!allVehicles) {
        return (
            <Container service={service}>
                <Block label="lubelogger.vehicles" />
                <Block label="lubelogger.serviceRecords" />
                <Block label="lubelogger.reminders" />
            </Container>
        );
    }

    const { vehicleID } = widget;
    const vehicleInfo = vehicleID ? allVehicles.filter((v) => v.vehicleData.id === vehicleID) : allVehicles;
    const totalReminders = vehicleInfo.reduce(
        (acc, val) => acc + val.veryUrgentReminderCount + val.urgentReminderCount + val.notUrgentReminderCount,
        0
    );
    const totalServiceRecords = vehicleInfo.reduce((acc, val) => acc + val.serviceRecordCount, 0);

    if (vehicleID) {
        if (vehicleInfo.length === 0) {
            return <Container service={service} error={{ message: "Vehicle not found" }} />;
        }

        const nextReminder = vehicleInfo[0].nextReminder
            ? t("common.date", { value: vehicleInfo[0].nextReminder.dueDate })
            : t("lubelogger.none");
        return (
            <Container service={service}>
                <Block
                    label="lubelogger.vehicle"
                    value={`${vehicleInfo[0].vehicleData.year} ${vehicleInfo[0].vehicleData.model}`}
                />
                <Block label="lubelogger.serviceRecords" value={totalServiceRecords} />
                <Block label="lubelogger.reminders" value={totalReminders} />
                <Block label="lubelogger.nextReminder" value={nextReminder} />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="lubelogger.vehicles" value={vehicleInfo.length} />
            <Block label="lubelogger.serviceRecords" value={totalServiceRecords} />
            <Block label="lubelogger.reminders" value={totalReminders} />
        </Container>
    );
}
