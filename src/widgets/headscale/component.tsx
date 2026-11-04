import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { HeadscaleNodeResponse, HeadscaleOptions } from "@/widgets/headscale/types";

export default function Component({ service }: WidgetProps<HeadscaleOptions>) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data: nodeData, error: nodeError } = useWidgetAPI<HeadscaleNodeResponse>(widget, "node");

    if (nodeError) {
        return <Container service={service} error={nodeError} />;
    }

    if (!nodeData) {
        return (
            <Container service={service}>
                <Block label="headscale.name" />
                <Block label="headscale.address" />
                <Block label="headscale.last_seen" />
                <Block label="headscale.status" />
            </Container>
        );
    }

    const {
        givenName,
        ipAddresses: [address],
        lastSeen,
        online,
    } = nodeData.node;

    return (
        <Container service={service}>
            <Block label="headscale.name" value={givenName} />
            <Block label="headscale.address" value={address} />
            <Block label="headscale.last_seen" value={t("common.relativeDate", { value: lastSeen })} />
            <Block label="headscale.status" value={t(online ? "headscale.online" : "headscale.offline")} />
        </Container>
    );
}
