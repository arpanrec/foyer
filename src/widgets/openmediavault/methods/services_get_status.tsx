import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpenmediavaultService, OpenmediavaultServiceStatus } from "@/widgets/openmediavault/types";

const isRunningReduce = (acc: number, e: OpenmediavaultService) => {
    if (e.running) {
        return acc + 1;
    }
    return acc;
};
const notRunningReduce = (acc: number, e: OpenmediavaultService) => {
    if (!e.running) {
        return acc + 1;
    }
    return acc;
};

const items = [
    {
        label: "openmediavault.running",
        getNumber: (data?: OpenmediavaultService[]) => (!data ? null : data.reduce(isRunningReduce, 0)),
    },
    {
        label: "openmediavault.stopped",
        getNumber: (data?: OpenmediavaultService[]) => (!data ? null : data.reduce(notRunningReduce, 0)),
    },
    { label: "openmediavault.total", getNumber: (data?: OpenmediavaultService[]) => (!data ? null : data?.length) },
];

export default function Component({ service }: WidgetProps) {
    const { data, error } = useWidgetAPI<OpenmediavaultServiceStatus>(service.widget);

    if (error) {
        return <Container service={service} error={error} />;
    }

    const itemsWithData = items.map((item) => ({
        ...item,
        number: item.getNumber(data?.response?.data),
    }));

    return (
        <Container service={service}>
            {itemsWithData.map((e) => (
                <Block key={e.label} label={e.label} value={e.number} />
            ))}
        </Container>
    );
}
