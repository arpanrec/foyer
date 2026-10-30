import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { ApcupsStatus } from "@/widgets/apcups/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;
    const { data, error } = useWidgetAPI<ApcupsStatus>(widget);

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="apcups.status" />
                <Block label="apcups.load" />
                <Block label="apcups.bcharge" />
                <Block label="apcups.timeleft" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="apcups.status" value={data.status} />
            <Block label="apcups.load" value={data.load} />
            <Block label="apcups.bcharge" value={data.bcharge} />
            <Block label="apcups.timeleft" value={data.timeleft} />
        </Container>
    );
}
