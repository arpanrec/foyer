import { useTranslation } from "next-i18next/pages";
import useSWR from "swr";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import type { ProxmoxVMOptions, ProxmoxVMStats } from "@/widgets/proxmoxvm/types";

export default function ProxmoxVM({ service }: WidgetProps<ProxmoxVMOptions>) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data, error } = useSWR<ProxmoxVMStats>(
        `/api/proxmox/stats/${widget.node}/${widget.vmid}?type=${widget.type || "qemu"}`
    );

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!data) {
        return (
            <Container service={service}>
                <Block label="resources.cpu" />
                <Block label="resources.mem" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block
                label="resources.cpu"
                value={t("common.percent", { value: data.cpu * 100 })}
                highlightValue={data.cpu * 100}
            />
            <Block label="resources.mem" value={t("common.bytes", { value: data.mem })} highlightValue={data.mem} />
        </Container>
    );
}
