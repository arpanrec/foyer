import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MealieOptions, MealieStatistics } from "@/widgets/mealie/types";

export default function Component({ service }: WidgetProps<MealieOptions>) {
    const { t } = useTranslation();
    const { widget } = service;
    const version = widget.version ?? 1;
    const { data, error } = useWidgetAPI<MealieStatistics>(widget, version === 1 ? "statisticsv1" : "statisticsv2");

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="mealie.recipes" />
                <Block label="mealie.users" />
                <Block label="mealie.categories" />
                <Block label="mealie.tags" />
            </Container>
        );
    }
    return (
        <Container service={service}>
            <Block label="mealie.recipes" value={t("common.number", { value: data.totalRecipes })} />
            <Block label="mealie.users" value={t("common.number", { value: data.totalUsers })} />
            <Block label="mealie.categories" value={t("common.number", { value: data.totalCategories })} />
            <Block label="mealie.tags" value={t("common.number", { value: data.totalTags })} />
        </Container>
    );
}
