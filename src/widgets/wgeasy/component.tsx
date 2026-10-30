import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { WgEasyClients, WgEasyOptions } from "@/widgets/wgeasy/types";

const DEFAULT_FIELDS = ["connected", "enabled", "total"];

export default function Component({ service: configuredService }: WidgetProps<WgEasyOptions>) {
    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;

    const endpoint = widget.version === 2 ? "clientv2" : "client";

    const { data: infoData, error: infoError } = useWidgetAPI<WgEasyClients>(widget, endpoint);

    if (infoError || (infoData?.statusCode ?? 0) > 400) {
        return (
            <Container service={service} error={infoError ?? { message: infoData?.statusMessage, data: infoData }} />
        );
    }

    if (!infoData) {
        return (
            <Container service={service}>
                <Block label="wgeasy.connected" />
                <Block label="wgeasy.enabled" />
                <Block label="wgeasy.disabled" />
                <Block label="wgeasy.total" />
            </Container>
        );
    }

    const enabled = infoData.filter((item) => item.enabled).length;
    const disabled = infoData.length - enabled;
    const connectionThreshold = (configuredService.widget.threshold ?? 2) * 60 * 1000;
    // oxlint-disable-next-line react/purity -- the current time is read on every render
    const currentTime = new Date();
    const connected = infoData.filter(
        (item) => currentTime.getTime() - new Date(item.latestHandshakeAt).getTime() < connectionThreshold
    ).length;

    return (
        <Container service={service}>
            <Block label="wgeasy.connected" value={connected} />
            <Block label="wgeasy.enabled" value={enabled} />
            <Block label="wgeasy.disabled" value={disabled} />
            <Block label="wgeasy.total" value={infoData.length} />
        </Container>
    );
}
