import { useEffect, useState } from "react";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import apiFetch from "@/utils/api-fetch";
import { formatProxyUrl } from "@/utils/proxy/api-helpers";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { UnmanicPending, UnmanicWorkers } from "@/widgets/unmanic/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: workersData, error: workersError } = useWidgetAPI<UnmanicWorkers>(widget, "workers");

    const [pendingData, setPendingData] = useState<UnmanicPending | null>(null);

    useEffect(() => {
        async function fetchPending() {
            const url = formatProxyUrl(widget, "pending");
            setPendingData(await apiFetch<UnmanicPending>(url, { method: "POST" }));
        }
        if (!pendingData) {
            fetchPending();
        }
    }, [widget, pendingData]);

    if (workersError) {
        return <Container service={service} error={workersError} />;
    }

    if (!workersData || !pendingData) {
        return (
            <Container service={service}>
                <Block label="unmanic.active_workers" />
                <Block label="unmanic.total_workers" />
                <Block label="unmanic.records_total" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="unmanic.active_workers" value={workersData.active_workers} />
            <Block label="unmanic.total_workers" value={workersData.total_workers} />
            <Block label="unmanic.records_total" value={pendingData.recordsTotal} />
        </Container>
    );
}
