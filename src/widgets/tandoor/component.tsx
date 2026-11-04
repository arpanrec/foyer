import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { TandoorKeywords, TandoorSpaces } from "@/widgets/tandoor/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: spaceData, error: spaceError } = useWidgetAPI<TandoorSpaces>(widget, "space");
    const { data: keywordData, error: keywordError } = useWidgetAPI<TandoorKeywords>(widget, "keyword");

    if (spaceError || keywordError) {
        const finalError = spaceError ?? keywordError;
        return <Container service={service} error={finalError} />;
    }

    if (!spaceData || !keywordData) {
        return (
            <Container service={service}>
                <Block label="tandoor.users" />
                <Block label="tandoor.recipes" />
                <Block label="tandoor.keywords" />
            </Container>
        );
    }

    const space = Array.isArray(spaceData) ? spaceData[0] : spaceData.results?.[0];

    return (
        <Container service={service}>
            <Block label="tandoor.users" value={space?.user_count} />
            <Block label="tandoor.recipes" value={space?.recipe_count} />
            <Block label="tandoor.keywords" value={keywordData.count} />
        </Container>
    );
}
