import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { PaperlessngxStatistics } from "@/widgets/paperlessngx/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: statisticsData, error: statisticsError } = useWidgetAPI<PaperlessngxStatistics>(widget, "statistics");

    if (statisticsError) {
        return <Container service={service} error={statisticsError} />;
    }

    if (!statisticsData) {
        return (
            <Container service={service}>
                <Block label="paperlessngx.inbox" />
                <Block label="paperlessngx.total" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            {statisticsData.documents_inbox !== undefined && (
                <Block label="paperlessngx.inbox" value={statisticsData.documents_inbox} />
            )}
            <Block label="paperlessngx.total" value={statisticsData.documents_total} />
        </Container>
    );
}
