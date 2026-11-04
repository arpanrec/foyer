import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import withWidgetFields from "@/utils/widget-fields";
import type { NetbirdPeer, NetbirdUser } from "@/widgets/netbird/types";

const DEFAULT_FIELDS = ["online", "users"];

export default function Component({ service: configuredService }: WidgetProps) {
    const { t } = useTranslation();

    const service = withWidgetFields(configuredService, DEFAULT_FIELDS);
    const { widget } = service;

    const { data: peersData, error: peersError } = useWidgetAPI<NetbirdPeer[]>(widget, "peers");
    const { data: usersData, error: usersError } = useWidgetAPI<NetbirdUser[]>(widget, "users");

    const error = peersError ?? usersError;

    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!peersData || !usersData) {
        return (
            <Container service={service}>
                <Block label="netbird.online" />
                <Block label="netbird.users" />
                <Block label="netbird.login_expired" />
            </Container>
        );
    }

    const online = peersData.filter((peer) => peer.connected).length;
    const loginExpired = peersData.filter((peer) => peer.login_expired).length;
    const humanUsers = usersData.filter((user) => !user.is_service_user).length;

    return (
        <Container service={service}>
            <Block
                label="netbird.online"
                value={`${t("common.number", { value: online })} / ${t("common.number", { value: peersData.length })}`}
            />
            <Block label="netbird.users" value={t("common.number", { value: humanUsers })} />
            <Block label="netbird.login_expired" value={t("common.number", { value: loginExpired })} />
        </Container>
    );
}
