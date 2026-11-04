import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { NpmHost } from "@/widgets/npm/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: infoData, error: infoError } = useWidgetAPI<NpmHost[]>(widget, "hosts");

    if (infoError) {
        return <Container service={service} error={infoError} />;
    }

    if (!infoData) {
        return (
            <Container service={service}>
                <Block label="npm.enabled" />
                <Block label="npm.disabled" />
                <Block label="npm.total" />
            </Container>
        );
    }

    const enabled = infoData.filter((c) => !!c.enabled).length;
    const disabled = infoData.filter((c) => !c.enabled).length;
    const total = infoData.length;

    return (
        <Container service={service}>
            <Block label="npm.enabled" value={enabled} />
            <Block label="npm.disabled" value={disabled} />
            <Block label="npm.total" value={total} />
        </Container>
    );
}
