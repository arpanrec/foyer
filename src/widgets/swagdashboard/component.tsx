import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { SwagdashboardOverview } from "@/widgets/swagdashboard/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: swagData, error: swagError } = useWidgetAPI<SwagdashboardOverview>(widget, "overview");

    if (swagError) {
        return <Container service={service} error={swagError} />;
    }

    if (!swagData) {
        return (
            <Container service={service}>
                <Block label="swagdashboard.proxied" />
                <Block label="swagdashboard.auth" />
                <Block label="swagdashboard.outdated" />
                <Block label="swagdashboard.banned" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="swagdashboard.proxied" value={swagData.proxied} />
            <Block label="swagdashboard.auth" value={swagData.auth} />
            <Block label="swagdashboard.outdated" value={swagData.outdated} />
            <Block label="swagdashboard.banned" value={swagData.banned} />
        </Container>
    );
}
