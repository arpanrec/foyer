import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { MinecraftStatus } from "@/widgets/minecraft/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;
    const { data: serverData, error: serverError } = useWidgetAPI<MinecraftStatus>(widget, "status");
    const { t } = useTranslation();

    if (serverError) {
        return <Container service={service} error={serverError} />;
    }
    if (!serverData) {
        return (
            <Container service={service}>
                <Block label="minecraft.status" />
                <Block label="minecraft.players" />
                <Block label="minecraft.version" />
            </Container>
        );
    }

    const statusIndicator = serverData.online ? t("minecraft.up") : t("minecraft.down");
    const players = serverData.players ? `${serverData.players.online} / ${serverData.players.max}` : "-";
    const version = serverData.version || "-";

    return (
        <Container service={service}>
            <Block label="minecraft.status" value={statusIndicator} />
            <Block label="minecraft.players" value={players} />
            <Block label="minecraft.version" value={version} />
        </Container>
    );
}
