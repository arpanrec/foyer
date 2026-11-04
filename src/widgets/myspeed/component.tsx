import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MyspeedData } from "@/widgets/myspeed/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { widget } = service;
    const { data, error } = useWidgetAPI<MyspeedData>(widget, "info");

    // a failed call answers with an object, so only a list holds speed tests
    const latest = Array.isArray(data) ? data[0] : undefined;
    const message = data && !Array.isArray(data) ? data.message : undefined;

    if (error || message || latest?.error) {
        let finalError = error ?? data;
        if (latest?.error) {
            try {
                finalError = JSON.parse(latest.error);
            } catch (e) {
                finalError = latest.error;
            }
        }
        return <Container service={service} error={finalError} />;
    }

    if (!latest) {
        return (
            <Container service={service}>
                <Block label="myspeed.download" />
                <Block label="myspeed.upload" />
                <Block label="myspeed.ping" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="myspeed.download"
                value={t("common.bitrate", {
                    value: latest.download * 1000 * 1000,
                    decimals: 2,
                })}
            />
            <Block
                label="myspeed.upload"
                value={t("common.bitrate", {
                    value: latest.upload * 1000 * 1000,
                    decimals: 2,
                })}
            />
            <Block
                label="myspeed.ping"
                value={t("common.ms", {
                    value: latest.ping,
                    style: "unit",
                    unit: "millisecond",
                })}
                highlightValue={latest.ping}
            />
        </Container>
    );
}
