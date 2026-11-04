import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { JellystatOptions, JellystatViews } from "@/widgets/jellystat/types";

export default function Component({ service: configuredService }: WidgetProps<JellystatOptions>) {
    const configuredDays = configuredService.widget.days;
    const days =
        typeof configuredDays === "number" && Number.isInteger(configuredDays) && configuredDays > 0
            ? configuredDays
            : 30;
    const widget = { ...configuredService.widget, days };
    const service = { ...configuredService, widget };

    const { data: viewsData, error: viewsError } = useWidgetAPI<JellystatViews>(widget, "getViewsByLibraryType", {
        days,
    });

    const error = viewsError || viewsData?.message;
    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!viewsData) {
        return (
            <Container service={service}>
                <Block label="jellystat.songs" />
                <Block label="jellystat.movies" />
                <Block label="jellystat.episodes" />
                <Block label="jellystat.other" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="jellystat.songs" value={viewsData.Audio} />
            <Block label="jellystat.movies" value={viewsData.Movie} />
            <Block label="jellystat.episodes" value={viewsData.Series} />
            <Block label="jellystat.other" value={viewsData.Other} />
        </Container>
    );
}
