import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type {
    KomodoContainersSummary,
    KomodoOptions,
    KomodoServersSummary,
    KomodoStacksSummary,
} from "@/widgets/komodo/types";

const SUMMARY_FIELDS = ["servers", "stacks", "containers"];
const STACK_FIELDS = ["total", "running", "down", "unhealthy"];
const CONTAINER_FIELDS = ["total", "running", "stopped", "unhealthy"];

export default function Component({ service: configuredService }: WidgetProps<KomodoOptions>) {
    const { t } = useTranslation();
    const configuredWidget = configuredService.widget;
    const defaultFields = configuredWidget.showSummary
        ? SUMMARY_FIELDS
        : configuredWidget.showStacks
          ? STACK_FIELDS
          : CONTAINER_FIELDS;
    const service = withWidgetFields(configuredService, defaultFields);
    const { widget } = service;
    const { showSummary, showStacks } = configuredWidget;
    const containersEndpoint = !(!showSummary && showStacks) ? "containers" : "";
    const { data: containersData, error: containersError } = useWidgetAPI<KomodoContainersSummary>(
        widget,
        containersEndpoint
    );
    const stacksEndpoint = showSummary || showStacks ? "stacks" : "";
    const { data: stacksData, error: stacksError } = useWidgetAPI<KomodoStacksSummary>(widget, stacksEndpoint);
    const serversEndpoint = showSummary ? "servers" : "";
    const { data: serversData, error: serversError } = useWidgetAPI<KomodoServersSummary>(widget, serversEndpoint);

    if (containersError || stacksError || serversError) {
        return <Container service={service} error={containersError ?? stacksError ?? serversError} />;
    }

    if (
        (!showStacks && !containersData) ||
        (showSummary && (!containersData || !stacksData || !serversData)) ||
        (showStacks && !stacksData)
    ) {
        return showSummary ? (
            <Container service={service}>
                <Block label="komodo.servers" />
                <Block label="komodo.stacks" />
                <Block label="komodo.containers" />
            </Container>
        ) : showStacks ? (
            <Container service={service}>
                <Block label="komodo.total" />
                <Block label="komodo.running" />
                <Block label="komodo.down" />
                <Block label="komodo.unhealthy" />
            </Container>
        ) : (
            <Container service={service}>
                <Block label="komodo.total" />
                <Block label="komodo.running" />
                <Block label="komodo.stopped" />
                <Block label="komodo.unhealthy" />
            </Container>
        );
    }

    if (showSummary && serversData && stacksData && containersData) {
        return (
            <Container service={service}>
                <Block label="komodo.servers" value={`${serversData.healthy} / ${serversData.total}`} />
                <Block label="komodo.stacks" value={`${stacksData.running} / ${stacksData.total}`} />
                <Block label="komodo.containers" value={`${containersData.running} / ${containersData.total}`} />
            </Container>
        );
    }

    if (showStacks && stacksData) {
        return (
            <Container service={service}>
                <Block label="komodo.total" value={t("common.number", { value: stacksData.total })} />
                <Block label="komodo.running" value={t("common.number", { value: stacksData.running })} />
                <Block
                    label="komodo.down"
                    value={t("common.number", { value: stacksData.stopped + stacksData.down })}
                />
                <Block label="komodo.unhealthy" value={t("common.number", { value: stacksData.unhealthy })} />
                <Block label="komodo.unknown" value={t("common.number", { value: stacksData.unknown })} />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="komodo.total" value={t("common.number", { value: containersData?.total })} />
            <Block label="komodo.running" value={t("common.number", { value: containersData?.running })} />
            <Block label="komodo.stopped" value={t("common.number", { value: containersData?.stopped })} />
            <Block label="komodo.unhealthy" value={t("common.number", { value: containersData?.unhealthy })} />
            <Block label="komodo.unknown" value={t("common.number", { value: containersData?.unknown })} />
        </Container>
    );
}
