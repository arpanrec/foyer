import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { FilebrowserUsage } from "@/widgets/filebrowser/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: usage, error: usageError } = useWidgetAPI<FilebrowserUsage>(widget, "usage");

    if (usageError) {
        return <Container service={service} error={usageError} />;
    }

    if (!usage) {
        return (
            <Container service={service}>
                <Block label="filebrowser.available" />
                <Block label="filebrowser.used" />
                <Block label="filebrowser.total" />
            </Container>
        );
    }

    const available = (usage?.total ?? 0) - (usage?.used ?? 0);

    return (
        <Container service={service}>
            <Block
                label="filebrowser.available"
                value={t("common.bytes", { value: available })}
                highlightValue={available}
            />
            <Block
                label="filebrowser.used"
                value={t("common.bytes", { value: usage?.used ?? 0 })}
                highlightValue={usage?.used ?? 0}
            />
            <Block
                label="filebrowser.total"
                value={t("common.bytes", { value: usage?.total ?? 0 })}
                highlightValue={usage?.total ?? 0}
            />
        </Container>
    );
}
