import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpenwrtInterface } from "@/widgets/openwrt/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();
    const { data, error } = useWidgetAPI<OpenwrtInterface>(service.widget);

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return null;
    }

    const { up, bytesTx, bytesRx } = data;

    return (
        <Container service={service}>
            <Block label="widget.status" value={up ? t("openwrt.up") : t("openwrt.down")} />
            <Block label="openwrt.bytesTx" value={t("common.bytes", { value: bytesTx })} highlightValue={bytesTx} />
            <Block label="openwrt.bytesRx" value={t("common.bytes", { value: bytesRx })} highlightValue={bytesRx} />
        </Container>
    );
}
