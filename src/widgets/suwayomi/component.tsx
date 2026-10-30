import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { SuwayomiCount } from "@/widgets/suwayomi/types";

const DEFAULT_FIELDS = ["download", "nondownload", "read", "unread"];

export default function Component({ service: configuredService }: WidgetProps) {
    const { t } = useTranslation();

    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;

    const { data: suwayomiData, error: suwayomiError } = useWidgetAPI<SuwayomiCount[]>(widget);

    if (suwayomiError) {
        return <Container service={service} error={suwayomiError} />;
    }

    if (!suwayomiData) {
        return (
            <Container service={service}>
                {widget.fields.map((field) => (
                    <Block key={field} label={`suwayomi.${field}`} />
                ))}
            </Container>
        );
    }

    return (
        <Container service={service}>
            {suwayomiData.map((data) => (
                <Block key={data.label} label={data.label} value={t("common.number", { value: data.count })} />
            ))}
        </Container>
    );
}
