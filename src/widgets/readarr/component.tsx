import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { ReadarrBookData, ReadarrQueueStatus, ReadarrWantedData } from "@/widgets/readarr/types";

export default function Component({ service }: WidgetProps) {
    const { t } = useTranslation();

    const { widget } = service;

    const { data: booksData, error: booksError } = useWidgetAPI<ReadarrBookData>(widget, "book");
    const { data: wantedData, error: wantedError } = useWidgetAPI<ReadarrWantedData>(widget, "wanted/missing");
    const { data: queueData, error: queueError } = useWidgetAPI<ReadarrQueueStatus>(widget, "queue/status");

    if (booksError || wantedError || queueError) {
        const finalError = booksError ?? wantedError ?? queueError;
        return <Container service={service} error={finalError} />;
    }

    if (!booksData || !wantedData || !queueData) {
        return (
            <Container service={service}>
                <Block label="readarr.wanted" />
                <Block label="readarr.queued" />
                <Block label="readarr.books" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="readarr.wanted" value={t("common.number", { value: wantedData.totalRecords })} />
            <Block label="readarr.queued" value={t("common.number", { value: queueData.totalCount })} />
            <Block label="readarr.books" value={t("common.number", { value: booksData.have })} />
        </Container>
    );
}
