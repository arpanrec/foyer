import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { PterodactylNodesData } from "@/widgets/pterodactyl/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: nodesData, error: nodesError } = useWidgetAPI<PterodactylNodesData>(widget, "nodes");

    if (nodesError) {
        return <Container service={service} error={nodesError} />;
    }

    if (!nodesData) {
        return (
            <Container service={service}>
                <Block label="pterodactyl.nodes" />
                <Block label="pterodactyl.servers" />
            </Container>
        );
    }

    const totalServers = nodesData.data.reduce(
        (total, node) => (node.attributes?.relationships?.servers?.data?.length ?? 0) + total,
        0
    );

    return (
        <Container service={service}>
            <Block label="pterodactyl.nodes" value={nodesData.data.length} />
            <Block label="pterodactyl.servers" value={totalServers} />
        </Container>
    );
}
