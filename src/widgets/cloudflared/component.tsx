import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { CloudflaredConnections, CloudflaredTunnel } from "@/widgets/cloudflared/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: statsData, error: statsError } = useWidgetAPI<CloudflaredTunnel>(widget, "cfd_tunnel");
    const { data: connectionsData, error: connectionsError } = useWidgetAPI<CloudflaredConnections>(
        widget,
        "connections"
    );

    if (statsError || connectionsError) {
        return <Container service={service} error={statsError ?? connectionsError} />;
    }

    if (!statsData) {
        return (
            <Container service={service}>
                <Block label="cloudflared.status" />
                <Block label="cloudflared.origin_ip" />
            </Container>
        );
    }

    const originIP = connectionsData?.result
        .flatMap((connector) => connector.conns ?? [])
        .find((connection) => connection.origin_ip)?.origin_ip;

    return (
        <Container service={service}>
            <Block
                label="cloudflared.status"
                value={statsData.result.status.charAt(0).toUpperCase() + statsData.result.status.slice(1)}
            />
            <Block label="cloudflared.origin_ip" value={connectionsData ? (originIP ?? "-") : undefined} />
        </Container>
    );
}
