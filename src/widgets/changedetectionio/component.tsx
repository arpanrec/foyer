import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { ChangedetectionioWatches } from "@/widgets/changedetectionio/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data, error } = useWidgetAPI<ChangedetectionioWatches>(widget, "info");

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="changedetectionio.diffsDetected" />
                <Block label="changedetectionio.totalObserved" />
            </Container>
        );
    }

    const totalObserved = Object.keys(data).length;
    let diffsDetected = 0;

    Object.keys(data).forEach((key) => {
        if (data[key].last_changed > 0 && !data[key].viewed) {
            diffsDetected += 1;
        }
    });

    return (
        <Container service={service}>
            <Block label="changedetectionio.diffsDetected" value={t("common.number", { value: diffsDetected })} />
            <Block label="changedetectionio.totalObserved" value={t("common.number", { value: totalObserved })} />
        </Container>
    );
}
