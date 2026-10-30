import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MoonrakerDisplayStatus, MoonrakerPrintStats, MoonrakerWebhooks } from "@/widgets/moonraker/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: printStats, error: printStatsError } = useWidgetAPI<MoonrakerPrintStats>(widget, "print_stats");
    const { data: displayStatus, error: displayStatsError } = useWidgetAPI<MoonrakerDisplayStatus>(
        widget,
        "display_status"
    );
    const { data: webHooks, error: webHooksError } = useWidgetAPI<MoonrakerWebhooks>(widget, "webhooks");

    if (printStatsError || displayStatsError || webHooksError) {
        const finalError = printStatsError ?? displayStatsError ?? webHooksError;
        return <Container service={service} error={finalError} />;
    }

    if (!printStats || !displayStatus || !webHooks) {
        return (
            <Container service={service}>
                <Block label="moonraker.printer_state" />
            </Container>
        );
    }

    if (webHooks.result.status.webhooks.state === "shutdown") {
        return (
            <Container service={service}>
                <Block label="moonraker.printer_state" value={webHooks.result.status.webhooks.state} />
            </Container>
        );
    }

    const printStatsInfo = printStats.result.status.print_stats.info ?? {};
    const { current_layer: currentLayer = "-", total_layer: totalLayer = "-" } = printStatsInfo;
    const layers =
        printStats.result.status.print_stats.state === "standby" ? "- / -" : `${currentLayer} / ${totalLayer}`;
    const progress =
        printStats.result.status.print_stats.state === "standby"
            ? "-"
            : t("common.percent", { value: displayStatus.result.status.display_status.progress * 100 });

    return (
        <Container service={service}>
            <Block label="moonraker.layers" value={layers} />
            <Block label="moonraker.print_progress" value={progress} />
            <Block label="moonraker.print_status" value={printStats.result.status.print_stats.state} />
        </Container>
    );
}
