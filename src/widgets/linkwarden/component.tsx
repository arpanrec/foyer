import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { LinkwardenCollectionsData, LinkwardenTagsData } from "@/widgets/linkwarden/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: collectionsStatsData, error: collectionsStatsError } = useWidgetAPI<LinkwardenCollectionsData>(
        widget,
        "collections"
    );
    const { data: tagsStatsData, error: tagsStatsError } = useWidgetAPI<LinkwardenTagsData>(widget, "tags");

    // Some APIs return raw arrays, others wrap the payload (e.g. { response: [...] }).
    const collections = Array.isArray(collectionsStatsData) ? collectionsStatsData : collectionsStatsData?.response;
    const tags = Array.isArray(tagsStatsData) ? tagsStatsData : (tagsStatsData?.response ?? tagsStatsData?.data?.tags);

    const totalLinks = collections
        ? collections.reduce((sum: number, collection) => sum + (collection._count?.links || 0), 0)
        : null;
    const collectionsTotal = collections ? collections.length : null;
    const tagsTotal = tags ? tags.length : null;

    if (collectionsStatsError || tagsStatsError) {
        return <Container service={service} error={collectionsStatsError || tagsStatsError} />;
    }

    if (!tagsStatsData || !collectionsStatsData) {
        return (
            <Container service={service}>
                <Block label="linkwarden.links" />
                <Block label="linkwarden.collections" />
                <Block label="linkwarden.tags" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="linkwarden.links" value={totalLinks} />
            <Block label="linkwarden.collections" value={collectionsTotal} />
            <Block label="linkwarden.tags" value={tagsTotal} />
        </Container>
    );
}
