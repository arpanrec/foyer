import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { NtfyMessage } from "@/widgets/ntfy/types";

const DEFAULT_FIELDS = ["title", "message", "priority", "lastReceived"];

const priorityLabels: Record<number, string> = {
    1: "min",
    2: "low",
    3: "default",
    4: "high",
    5: "urgent",
};

function Truncated({ text }: { text: string }) {
    return (
        <span className="grid w-full" title={text}>
            <span className="truncate">{text}</span>
        </span>
    );
}

export default function Component({ service: configuredService }: WidgetProps) {
    const { t } = useTranslation();
    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;

    const { data: messagesData, error: messagesError } = useWidgetAPI<NtfyMessage>(widget, "messages");

    if (messagesError) {
        return <Container service={service} error={messagesError} />;
    }

    if (!messagesData) {
        return (
            <Container service={service}>
                <Block label="ntfy.title" />
                <Block label="ntfy.message" />
                <Block label="ntfy.priority" />
                <Block label="ntfy.lastReceived" />
                <Block label="ntfy.tags" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="ntfy.title" value={<Truncated text={messagesData.title ?? t("ntfy.none")} />} />
            <Block label="ntfy.message" value={<Truncated text={messagesData.message ?? t("ntfy.none")} />} />
            <Block label="ntfy.priority" value={t(`ntfy.${priorityLabels[messagesData.priority] ?? "default"}`)} />
            <Block
                label="ntfy.lastReceived"
                value={
                    messagesData.time ? t("common.relativeDate", { value: messagesData.time * 1000 }) : t("ntfy.none")
                }
            />
            <Block
                label="ntfy.tags"
                value={messagesData.tags?.length ? messagesData.tags.join(", ") : t("ntfy.none")}
            />
        </Container>
    );
}
