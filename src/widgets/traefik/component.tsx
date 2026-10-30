import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { TraefikOverview } from "@/widgets/traefik/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: traefikData, error: traefikError } = useWidgetAPI<TraefikOverview>(widget, "overview");

    if (traefikError) {
        return <Container service={service} error={traefikError} />;
    }

    if (!traefikData) {
        return (
            <Container service={service}>
                <Block label="traefik.routers" />
                <Block label="traefik.services" />
                <Block label="traefik.middleware" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="traefik.routers" value={traefikData.http.routers.total} />
            <Block label="traefik.services" value={traefikData.http.services.total} />
            <Block label="traefik.middleware" value={traefikData.http.middlewares.total} />
        </Container>
    );
}
