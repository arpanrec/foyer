import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { GitlabCounts, GitlabOptions } from "@/widgets/gitlab/types";

export default function Component({ service }: WidgetProps<GitlabOptions>) {
    const { t } = useTranslation();
    const { widget } = service;

    const { data: gitlabCounts, error: gitlabCountsError } = useWidgetAPI<GitlabCounts>(widget, "counts");

    if (gitlabCountsError) {
        return <Container service={service} error={gitlabCountsError} />;
    }

    if (!gitlabCounts) {
        return (
            <Container service={service}>
                <Block label="gitlab.groups" />
                <Block label="gitlab.issues" />
                <Block label="gitlab.merges" />
                <Block label="gitlab.projects" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="gitlab.groups" value={t("common.number", { value: gitlabCounts.groups_count })} />
            <Block label="gitlab.issues" value={t("common.number", { value: gitlabCounts.issues_count })} />
            <Block label="gitlab.merges" value={t("common.number", { value: gitlabCounts.merge_requests_count })} />
            <Block label="gitlab.projects" value={t("common.number", { value: gitlabCounts.projects_count })} />
        </Container>
    );
}
