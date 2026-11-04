import useSWR from "swr";

import Node from "@/components/widgets/longhorn/node";
import type { LonghornData, LonghornOptions } from "@/components/widgets/longhorn/types";
import Container from "@/components/widgets/widget/container";
import Error from "@/components/widgets/widget/error";
import Raw from "@/components/widgets/widget/raw";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";

export default function Longhorn({ options }: InfoWidgetProps<LonghornOptions>) {
    const { expanded, total, labels, include, nodes } = options;
    const { data, error } = useSWR<LonghornData>(`/api/widgets/longhorn`, {
        refreshInterval: 1500,
    });

    if (error || data?.error) {
        return <Error options={options} />;
    }

    if (!data) {
        return (
            <Container options={options} additionalClassNames="infomation-widget-longhorn">
                <Raw>
                    <div className="flex flex-row self-center flex-wrap justify-between" />
                </Raw>
            </Container>
        );
    }

    return (
        <Container options={options} additionalClassNames="infomation-widget-longhorn">
            <Raw>
                <div className="flex flex-row self-center flex-wrap justify-between">
                    {data.nodes
                        .filter((node) => {
                            if (node.id === "total") {
                                return total;
                            }
                            if (!nodes) {
                                return false;
                            }
                            if (include && !include.includes(node.id)) {
                                return false;
                            }
                            return true;
                        })
                        .map((node) => (
                            <div key={node.id}>
                                <Node data={{ node }} expanded={expanded} labels={labels} />
                            </div>
                        ))}
                </div>
            </Raw>
        </Container>
    );
}
