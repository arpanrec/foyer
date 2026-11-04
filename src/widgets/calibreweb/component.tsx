import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { CalibrewebStats } from "@/widgets/calibreweb/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;
    const { data, error } = useWidgetAPI<CalibrewebStats>(widget, "stats");

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="calibreweb.books" />
                <Block label="calibreweb.authors" />
                <Block label="calibreweb.categories" />
                <Block label="calibreweb.series" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="calibreweb.books" value={t("common.number", { value: data.books })} />
            <Block label="calibreweb.authors" value={t("common.number", { value: data.authors })} />
            <Block label="calibreweb.categories" value={t("common.number", { value: data.categories })} />
            <Block label="calibreweb.series" value={t("common.number", { value: data.series })} />
        </Container>
    );
}
