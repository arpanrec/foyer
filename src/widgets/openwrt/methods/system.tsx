import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpenwrtSystem } from "@/widgets/openwrt/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { data, error } = useWidgetAPI<OpenwrtSystem>(service.widget);

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return null;
    }

    const { uptime, cpuLoad } = data;

    return (
        <Container service={service}>
            <Block label="openwrt.uptime" value={t("common.duration", { value: uptime })} />
            <Block label="openwrt.cpuLoad" value={cpuLoad} />
        </Container>
    );
}
