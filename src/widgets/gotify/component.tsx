import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { GotifyApp, GotifyClient, GotifyMessages } from "@/widgets/gotify/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: appsData, error: appsError } = useWidgetAPI<GotifyApp[]>(widget, "application");
    const { data: messagesData, error: messagesError } = useWidgetAPI<GotifyMessages>(widget, "message");
    const { data: clientsData, error: clientsError } = useWidgetAPI<GotifyClient[]>(widget, "client");

    if (appsError || messagesError || clientsError) {
        const finalError = appsError ?? messagesError ?? clientsError;
        return <Container service={service} error={finalError} />;
    }

    if (!appsData || !messagesData || !clientsData) {
        return (
            <Container service={service}>
                <Block label="gotify.apps" />
                <Block label="gotify.clients" />
                <Block label="gotify.messages" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="gotify.apps" value={appsData?.length} />
            <Block label="gotify.clients" value={clientsData?.length} />
            <Block label="gotify.messages" value={messagesData?.messages?.length} />
        </Container>
    );
}
