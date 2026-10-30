import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { GluetunIpData, GluetunOptions, GluetunPortForwardedData } from "@/widgets/gluetun/types";

const DEFAULT_FIELDS = ["public_ip", "region", "country"];

export default function Component({ service: configuredService }: WidgetProps<GluetunOptions>) {
    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;
    const { version = 1 } = configuredService.widget;

    const { data: gluetunData, error: gluetunError } = useWidgetAPI<GluetunIpData>(widget, "ip");
    const includePF = widget.fields.includes("port_forwarded");
    const pfEndpoint = version > 1 ? "port_forwarded_v2" : "port_forwarded";
    const { data: portForwardedData, error: portForwardedError } = useWidgetAPI<GluetunPortForwardedData>(
        widget,
        includePF ? pfEndpoint : ""
    );

    if (gluetunError || (includePF && portForwardedError)) {
        return <Container service={service} error={gluetunError || portForwardedError} />;
    }

    if (!gluetunData || (includePF && !portForwardedData)) {
        return (
            <Container service={service}>
                <Block label="gluetun.public_ip" />
                <Block label="gluetun.region" />
                <Block label="gluetun.country" />
                <Block label="gluetun.port_forwarded" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="gluetun.public_ip" value={gluetunData.public_ip} />
            <Block label="gluetun.region" value={gluetunData.region} />
            <Block label="gluetun.country" value={gluetunData.country} />
            <Block label="gluetun.port_forwarded" value={portForwardedData?.port} />
        </Container>
    );
}
