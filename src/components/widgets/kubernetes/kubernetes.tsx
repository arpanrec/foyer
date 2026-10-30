import { useTranslation } from "next-i18next/pages";
import useSWR from "swr";

import Node from "@/components/widgets/kubernetes/node";
import type { KubernetesData, KubernetesOptions, KubernetesUsage } from "@/components/widgets/kubernetes/types";
import Container from "@/components/widgets/widget/container";
import Error from "@/components/widgets/widget/error";
import Raw from "@/components/widgets/widget/raw";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";

export default function Widget({ options }: InfoWidgetProps<KubernetesOptions>) {
    const { cluster, nodes } = options;
    const { i18n } = useTranslation();

    const defaultData: KubernetesUsage = {
        cpu: {
            load: 0,
            total: 0,
            percent: 0,
        },
        memory: {
            used: 0,
            total: 0,
            free: 0,
            percent: 0,
        },
    };

    const { data, error } = useSWR<KubernetesData>(
        `/api/widgets/kubernetes?${new URLSearchParams({ lang: i18n.language }).toString()}`,
        {
            refreshInterval: 1500,
        }
    );

    if (error || data?.error) {
        return <Error options={options} />;
    }

    if (!data) {
        return (
            <Container options={options} additionalClassNames="information-widget-kubernetes">
                <Raw>
                    <div className="flex flex-row self-center flex-wrap justify-between">
                        {cluster?.show && <Node type="cluster" key="cluster" options={cluster} data={defaultData} />}
                        {nodes?.show && <Node type="node" key="nodes" options={nodes} data={defaultData} />}
                    </div>
                </Raw>
            </Container>
        );
    }

    return (
        <Container options={options} additionalClassNames="information-widget-kubernetes">
            <Raw>
                <div className="flex flex-row self-center flex-wrap justify-between">
                    {cluster?.show && <Node key="cluster" type="cluster" options={cluster} data={data.cluster} />}
                    {nodes?.show &&
                        data.nodes &&
                        data.nodes.map((node) => <Node key={node.name} type="node" options={nodes} data={node} />)}
                </div>
            </Raw>
        </Container>
    );
}
