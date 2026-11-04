import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OmbiRequestCount } from "@/widgets/ombi/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: statsData, error: statsError } = useWidgetAPI<OmbiRequestCount>(widget, "Request/count");

    if (statsError) {
        return <Container service={service} error={statsError} />;
    }

    if (!statsData) {
        return (
            <Container service={service}>
                <Block label="ombi.pending" />
                <Block label="ombi.approved" />
                <Block label="ombi.available" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="ombi.pending" value={statsData.pending} />
            <Block label="ombi.approved" value={statsData.approved} />
            <Block label="ombi.available" value={statsData.available} />
        </Container>
    );
}
