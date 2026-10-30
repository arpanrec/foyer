import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { TubeArchivistCount, TubeArchivistDownloads } from "@/widgets/tubearchivist/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: downloadsData, error: downloadsError } = useWidgetAPI<TubeArchivistDownloads>(widget, "downloads");
    const { data: videosData, error: videosError } = useWidgetAPI<TubeArchivistCount>(widget, "videos");
    const { data: channelsData, error: channelsError } = useWidgetAPI<TubeArchivistCount>(widget, "channels");
    const { data: playlistsData, error: playlistsError } = useWidgetAPI<TubeArchivistCount>(widget, "playlists");

    if (downloadsError || videosError || channelsError || playlistsError || (downloadsData && downloadsData.detail)) {
        const finalError = downloadsError ?? videosError ?? channelsError ?? playlistsError ?? downloadsData?.detail;
        return <Container service={service} error={finalError} />;
    }

    if (!downloadsData || !videosData || !channelsData || !playlistsData) {
        return (
            <Container service={service}>
                <Block label="tubearchivist.downloads" />
                <Block label="tubearchivist.videos" />
                <Block label="tubearchivist.channels" />
                <Block label="tubearchivist.playlists" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="tubearchivist.downloads" value={t("common.number", { value: downloadsData.pending ?? 0 })} />
            <Block label="tubearchivist.videos" value={t("common.number", { value: videosData.doc_count ?? 0 })} />
            <Block label="tubearchivist.channels" value={t("common.number", { value: channelsData.doc_count ?? 0 })} />
            <Block
                label="tubearchivist.playlists"
                value={t("common.number", { value: playlistsData.doc_count ?? 0 })}
            />
        </Container>
    );
}
