import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { AudiobookshelfLibrary } from "@/widgets/audiobookshelf/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;
    const { data: librariesData, error: librariesError } = useWidgetAPI<AudiobookshelfLibrary[]>(widget, "libraries");

    if (librariesError) {
        return <Container service={service} error={librariesError} />;
    }

    if (!librariesData) {
        return (
            <Container service={service}>
                <Block label="audiobookshelf.podcasts" />
                <Block label="audiobookshelf.podcastsDuration" />
                <Block label="audiobookshelf.books" />
                <Block label="audiobookshelf.booksDuration" />
            </Container>
        );
    }

    const podcastLibraries = librariesData.filter((l) => l.mediaType === "podcast");
    const bookLibraries = librariesData.filter((l) => l.mediaType === "book");

    const totalPodcasts = podcastLibraries.reduce((total, pL) => parseInt(String(pL.stats?.totalItems), 10) + total, 0);
    const totalBooks = bookLibraries.reduce((total, bL) => parseInt(String(bL.stats?.totalItems), 10) + total, 0);

    const totalPodcastsDuration = podcastLibraries.reduce(
        (total, pL) => parseFloat(String(pL.stats?.totalDuration)) + total,
        0
    );
    const totalBooksDuration = bookLibraries.reduce(
        (total, bL) => parseFloat(String(bL.stats?.totalDuration)) + total,
        0
    );

    return (
        <Container service={service}>
            <Block label="audiobookshelf.podcasts" value={t("common.number", { value: totalPodcasts })} />
            <Block
                label="audiobookshelf.podcastsDuration"
                value={t("common.duration", {
                    value: totalPodcastsDuration,
                })}
            />
            <Block label="audiobookshelf.books" value={t("common.number", { value: totalBooks })} />
            <Block
                label="audiobookshelf.booksDuration"
                value={t("common.duration", {
                    value: totalBooksDuration,
                })}
            />
        </Container>
    );
}
