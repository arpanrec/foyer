import { useTranslation } from "next-i18next/pages";
import { FiHardDrive } from "react-icons/fi";

import type { LonghornNode } from "@/components/widgets/longhorn/types";
import Resource from "@/components/widgets/widget/resource";
import WidgetLabel from "@/components/widgets/widget/widget_label";

type NodeProps = {
    data: { node: LonghornNode };
    expanded?: boolean;
    labels?: boolean;
};

export default function Node({ data, expanded, labels }: NodeProps) {
    const { t } = useTranslation();

    return (
        <Resource
            additionalClassNames="information-widget-longhorn-node"
            icon={FiHardDrive}
            value={t("common.bytes", { value: data.node.available })}
            label={t("resources.free")}
            expandedValue={t("common.bytes", { value: data.node.maximum })}
            expandedLabel={t("resources.total")}
            percentage={Math.round(((data.node.maximum - data.node.available) / data.node.maximum) * 100)}
            expanded={expanded}
        >
            {labels && <WidgetLabel label={data.node.id} />}
        </Resource>
    );
}
