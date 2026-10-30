import { useTranslation } from "next-i18next/pages";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useCurrentTime from "@/utils/hooks/use-current-time";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { AuthentikEvent, AuthentikLoginPoint, AuthentikOptions, AuthentikUsers } from "@/widgets/authentik/types";

const DAY = 24 * 60 * 60 * 1000;

export default function Component({ service }: WidgetProps<AuthentikOptions>) {
    const { t } = useTranslation();
    const currentTime = useCurrentTime();

    const { widget } = service;
    const isV2 = widget.version === 2;

    const { data: usersData, error: usersError } = useWidgetAPI<AuthentikUsers>(widget, "users");

    const loginsEndpoint = isV2 ? "" : "login";
    const { data: loginsData, error: loginsError } = useWidgetAPI<AuthentikLoginPoint[]>(widget, loginsEndpoint);

    const failedLoginsEndpoint = isV2 ? "" : "login_failed";
    const { data: failedLoginsData, error: failedLoginsError } = useWidgetAPI<AuthentikLoginPoint[]>(
        widget,
        failedLoginsEndpoint
    );

    const eventsDataEndpoint = isV2 ? "datav2" : "";
    const { data: eventsData, error: eventsDataError } = useWidgetAPI<AuthentikEvent[]>(widget, eventsDataEndpoint);

    if (usersError || loginsError || failedLoginsError || eventsDataError) {
        const finalError = usersError ?? loginsError ?? failedLoginsError ?? eventsDataError;
        return <Container service={service} error={finalError} />;
    }

    const hasNoData = isV2 ? !usersData || !eventsData : !usersData || !loginsData || !failedLoginsData;

    if (hasNoData || !usersData) {
        return (
            <Container service={service}>
                <Block label="authentik.users" />
                <Block label="authentik.loginsLast24H" />
                <Block label="authentik.failedLoginsLast24H" />
                {isV2 && <Block label="authentik.authorizationsLast24H" />}
            </Container>
        );
    }

    let loginsLast24H: number | undefined;
    let failedLoginsLast24H: number | undefined;
    let authorizationsLast24H: number | undefined;
    switch (widget.version) {
        // v1 is default
        default:
            const yesterday = (currentTime ?? 0) - DAY;
            loginsLast24H = loginsData?.reduce(
                (total, current) => (current.x_cord >= yesterday ? total + current.y_cord : total),
                0
            );
            failedLoginsLast24H = failedLoginsData?.reduce(
                (total, current) => (current.x_cord >= yesterday ? total + current.y_cord : total),
                0
            );
            break;
        case 2:
            const events = Array.isArray(eventsData) ? eventsData : [];
            const result = events.reduce(
                (acc, current) => {
                    if (!current?.count || !current?.action) {
                        return acc;
                    }

                    if (current.action === "login") {
                        acc.logins += current.count;
                    } else if (current.action === "login_failed") {
                        acc.failed += current.count;
                    } else if (current.action === "authorize_application") {
                        acc.authorizations += current.count;
                    }

                    return acc;
                },
                { logins: 0, failed: 0, authorizations: 0 }
            );
            loginsLast24H = result.logins;
            failedLoginsLast24H = result.failed;
            authorizationsLast24H = result.authorizations;
            break;
    }

    return (
        <Container service={service}>
            <Block label="authentik.users" value={t("common.number", { value: usersData.pagination.count })} />
            <Block label="authentik.loginsLast24H" value={t("common.number", { value: loginsLast24H })} />
            <Block label="authentik.failedLoginsLast24H" value={t("common.number", { value: failedLoginsLast24H })} />
            {isV2 && (
                <Block
                    label="authentik.authorizationsLast24H"
                    value={t("common.number", { value: authorizationsLast24H })}
                />
            )}
        </Container>
    );
}
