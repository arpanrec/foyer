import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpenmediavaultDisk, OpenmediavaultSmartList } from "@/widgets/openmediavault/types";

const passedReduce = (acc: number, e: OpenmediavaultDisk) => {
    if (e.monitor && e.overallstatus === "GOOD") {
        return acc + 1;
    }
    return acc;
};
const failedReduce = (acc: number, e: OpenmediavaultDisk) => {
    if (e.monitor && e.overallstatus !== "GOOD") {
        return acc + 1;
    }
    return acc;
};

const items = [
    {
        label: "openmediavault.passed",
        getNumber: (data?: OpenmediavaultDisk[]) => (!data ? null : data.reduce(passedReduce, 0)),
    },
    {
        label: "openmediavault.failed",
        getNumber: (data?: OpenmediavaultDisk[]) => (!data ? null : data.reduce(failedReduce, 0)),
    },
];

export default function Component({ service }: WidgetProps) {
    const { data, error } = useWidgetAPI<OpenmediavaultSmartList>(service.widget);

    if (error) {
        return <Container service={service} error={error} />;
    }

    const itemsWithData = items.map((item) => ({
        ...item,
        number: item.getNumber(JSON.parse(data?.response?.output || "{}")?.data),
    }));

    return (
        <Container service={service}>
            {itemsWithData.map((e) => (
                <Block key={e.label} label={e.label} value={e.number} />
            ))}
        </Container>
    );
}
