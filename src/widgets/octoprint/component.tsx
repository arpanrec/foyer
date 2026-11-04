import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OctoprintJobStats, OctoprintPrinterStats } from "@/widgets/octoprint/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: printerStats, error: printerStatsError } = useWidgetAPI<OctoprintPrinterStats>(
        widget,
        "printer_stats"
    );
    const { data: jobStats, error: jobStatsError } = useWidgetAPI<OctoprintJobStats>(widget, "job_stats");

    if (printerStatsError && jobStats) {
        return (
            <Container service={service}>
                <Block label="octoprint.printer_state" value={jobStats.state} />
            </Container>
        );
    }

    if (printerStatsError) {
        return <Container service={service} error={printerStatsError} />;
    }

    if (jobStatsError) {
        return <Container service={service} error={jobStatsError} />;
    }

    const state = printerStats?.state?.text;
    const tempTool = printerStats?.temperature?.tool0?.actual;
    const tempBed = printerStats?.temperature?.bed?.actual;

    if (!printerStats || !state || !tempTool || !tempBed) {
        return (
            <Container service={service}>
                <Block label="octoprint.printer_state" />
            </Container>
        );
    }

    const printingStateFalgs = ["Printing", "Paused", "Pausing", "Resuming"];

    if (printingStateFalgs.includes(state)) {
        const completion = jobStats?.progress?.completion;

        if (!jobStats || !completion) {
            return (
                <Container service={service}>
                    <Block label="octoprint.printer_state" />
                    <Block label="octoprint.temp_tool" />
                    <Block label="octoprint.temp_bed" />
                    <Block label="octoprint.job_completion" />
                </Container>
            );
        }

        return (
            <Container service={service}>
                <Block label="octoprint.printer_state" value={state} />
                <Block label="octoprint.temp_tool" value={`${tempTool} °C`} />
                <Block label="octoprint.temp_bed" value={`${tempBed} °C`} />
                <Block label="octoprint.job_completion" value={`${completion.toFixed(2)}%`} />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="octoprint.printer_state" value={state} />
            <Block label="octoprint.temp_tool" value={`${tempTool} °C`} />
            <Block label="octoprint.temp_bed" value={`${tempBed} °C`} />
        </Container>
    );
}
