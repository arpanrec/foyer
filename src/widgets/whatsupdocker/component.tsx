import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { WhatsUpDockerContainer } from "@/widgets/whatsupdocker/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: containersData, error: containersError } = useWidgetAPI<WhatsUpDockerContainer[]>(
        widget,
        "containers"
    );

    if (containersError) {
        return <Container service={service} error={containersError} />;
    }

    if (!containersData) {
        return (
            <Container service={service}>
                <Block label="whatsupdocker.monitoring" />
                <Block label="whatsupdocker.updates" />
            </Container>
        );
    }

    const totalCount = containersData.length;
    const updatesAvailable = containersData.filter((container) => container.updateAvailable).length;

    return (
        <Container service={service}>
            <Block label="whatsupdocker.monitoring" value={totalCount} />
            <Block label="whatsupdocker.updates" value={updatesAvailable} />
        </Container>
    );
}
