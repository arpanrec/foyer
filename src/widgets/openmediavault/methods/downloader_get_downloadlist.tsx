import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { OpenmediavaultDownload, OpenmediavaultDownloadList } from "@/widgets/openmediavault/types";

const downloadReduce = (acc: number, e: OpenmediavaultDownload) => {
    if (e.downloading) {
        return acc + 1;
    }
    return acc;
};

const items = [
    {
        label: "openmediavault.downloading",
        getNumber: (data?: OpenmediavaultDownload[]) => (!data ? null : data.reduce(downloadReduce, 0)),
    },
    { label: "openmediavault.total", getNumber: (data?: OpenmediavaultDownload[]) => (!data ? null : data?.length) },
];

export default function Component({ service }: WidgetProps) {
    const { data, error } = useWidgetAPI<OpenmediavaultDownloadList>(service.widget);

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
