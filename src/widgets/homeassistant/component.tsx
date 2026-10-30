import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { HomeassistantBlock, HomeassistantOptions } from "@/widgets/homeassistant/types";

export default function Component({ service }: WidgetProps<HomeassistantOptions>) {
    const { widget } = service;

    const { data, error } = useWidgetAPI<HomeassistantBlock[]>(widget, null, { refreshInterval: 60000 });
    if (error) {
        return <Container service={service} error={error} />;
    }

    return (
        <Container service={service}>
            {data?.map((d) => (
                <Block label={d.label} value={d.value} key={d.label} />
            ))}
        </Container>
    );
}
