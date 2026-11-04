import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { GiteaTotalCount } from "@/widgets/gitea/types";

export default function Component({ service }: WidgetProps) {
    const { widget } = service;

    const { data: giteaNotifications, error: giteaNotificationsError } = useWidgetAPI<GiteaTotalCount>(
        widget,
        "notifications"
    );
    const { data: giteaIssues, error: giteaIssuesError } = useWidgetAPI<GiteaTotalCount>(widget, "issues");
    const { data: giteaPulls, error: giteaPullsError } = useWidgetAPI<GiteaTotalCount>(widget, "pulls");
    const { data: giteaRepositories, error: giteaRepositoriesError } = useWidgetAPI<GiteaTotalCount>(
        widget,
        "repositories"
    );

    const error = giteaNotificationsError ?? giteaIssuesError ?? giteaPullsError ?? giteaRepositoriesError;
    if (error) {
        return <Container service={service} error={error} />;
    }

    if (!giteaNotifications || !giteaIssues || !giteaPulls || !giteaRepositories) {
        return (
            <Container service={service}>
                <Block label="gitea.notifications" />
                <Block label="gitea.issues" />
                <Block label="gitea.pulls" />
                <Block label="gitea.repositories" />
            </Container>
        );
    }

    return (
        <Container service={service}>
            <Block label="gitea.notifications" value={giteaNotifications.count} />
            <Block label="gitea.issues" value={giteaIssues.count} />
            <Block label="gitea.pulls" value={giteaPulls.count} />
            <Block label="gitea.repositories" value={giteaRepositories.count} />
        </Container>
    );
}
