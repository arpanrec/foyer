import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpnsenseActivity, OpnsenseInterfaces, OpnsenseOptions } from "@/widgets/opnsense/types";

export default function Component({ service }: WidgetProps<OpnsenseOptions>) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: activityData, error: activityError } = useWidgetAPI<OpnsenseActivity>(widget, "activity");
    const { data: interfaceData, error: interfaceError } = useWidgetAPI<OpnsenseInterfaces>(widget, "interface");

    if (activityError || interfaceError) {
        const finalError = activityError ?? interfaceError;
        return <Container service={service} error={finalError} />;
    }

    if (!activityData || !interfaceData) {
        return (
            <Container service={service}>
                <Block label="opnsense.cpu" />
                <Block label="opnsense.memory" />
                <Block label="opnsense.wanUpload" />
                <Block label="opnsense.wanDownload" />
            </Container>
        );
    }

    const cpuIdle = (activityData.headers[2].match(/ ([0-9.]+)% idle/) as RegExpMatchArray)[1];
    const cpu = 100 - parseFloat(cpuIdle);
    const memory = (activityData.headers[3].match(/Mem: (.+) Active,/) as RegExpMatchArray)[1];

    const wan = widget.wan ? interfaceData.interfaces[widget.wan] : interfaceData.interfaces.wan;

    return (
        <Container service={service}>
            <Block label="opnsense.cpu" value={t("common.percent", { value: cpu.toFixed(2) })} highlightValue={cpu} />
            <Block label="opnsense.memory" value={memory} />
            {wan && (
                <Block
                    label="opnsense.wanUpload"
                    value={t("common.bytes", { value: wan["bytes transmitted"] })}
                    highlightValue={wan["bytes transmitted"]}
                />
            )}
            {wan && (
                <Block
                    label="opnsense.wanDownload"
                    value={t("common.bytes", { value: wan["bytes received"] })}
                    highlightValue={wan["bytes received"]}
                />
            )}
        </Container>
    );
}
