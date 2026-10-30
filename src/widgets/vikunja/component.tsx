import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import { useContext } from "react";

import Block from "@/components/services/widget/block";
import Container from "@/components/services/widget/container";
import type { WidgetProps } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";
import useCurrentTime from "@/utils/hooks/use-current-time";
import useWidgetAPI from "@/utils/proxy/use-widget-api";
import type { VikunjaList, VikunjaOptions, VikunjaProject, VikunjaTask } from "@/widgets/vikunja/types";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const rowClassName =
    "text-theme-700 dark:text-theme-200 relative h-5 rounded-md bg-theme-200/50 dark:bg-theme-900/20 m-1 px-1 flex";

export default function Component({ service }: WidgetProps<VikunjaOptions>) {
    const { t } = useTranslation();
    const { settings } = useContext(SettingsContext);
    const currentTime = useCurrentTime();
    const { widget } = service;

    const version = widget.version ?? 1;
    const target = service.target ?? settings?.target ?? "_blank";
    const rawBase =
        (service.href && service.href !== "#" ? service.href : undefined) ??
        (service.url as string | undefined) ??
        widget.url;
    const baseUrl = rawBase?.trim().replace(/\/+$/, "");

    const { data: projectsData, error: projectsError } = useWidgetAPI<VikunjaList<VikunjaProject>>(widget, "projects");
    const { data: tasksData, error: tasksError } = useWidgetAPI<VikunjaList<VikunjaTask>>(
        widget,
        version === 2 ? "tasks_v2" : "tasks"
    );

    if (projectsError || tasksError) {
        return <Container service={service} error={projectsError ?? tasksError} />;
    } else if (projectsData?.message || tasksData?.message) {
        return <Container service={service} error={projectsData?.message ?? tasksData?.message} />;
    }

    if (!projectsData || !tasksData) {
        return (
            <Container service={service}>
                <Block label="vikunja.projects" />
                <Block label="vikunja.tasks7d" />
                <Block label="vikunja.tasksOverdue" />
                <Block label="vikunja.tasksInProgress" />
            </Container>
        );
    }

    const projects = projectsData.filter((project) => project.id > 0); // saved filters have id < 0

    const oneWeekFromNow = new Date((currentTime ?? 0) + WEEK);
    const tasksWithDueDate = tasksData.filter((task) => !task.dueDateIsDefault);
    const tasks7d = tasksWithDueDate.filter((task) => new Date(task.dueDate) <= oneWeekFromNow);
    const tasksOverdue = tasksWithDueDate.filter((task) => new Date(task.dueDate) <= new Date(currentTime ?? 0));
    const tasksInProgress = tasksData.filter((task) => task.inProgress);

    return (
        <>
            <Container service={service}>
                <Block label="vikunja.projects" value={t("common.number", { value: projects.length })} />
                <Block label="vikunja.tasks7d" value={t("common.number", { value: tasks7d.length })} />
                <Block label="vikunja.tasksOverdue" value={t("common.number", { value: tasksOverdue.length })} />
                <Block label="vikunja.tasksInProgress" value={t("common.number", { value: tasksInProgress.length })} />
            </Container>
            {widget.enableTaskList &&
                tasksData.slice(0, 5).map((task) => {
                    const taskUrl =
                        baseUrl && task.id !== undefined && task.id !== null
                            ? `${baseUrl}/tasks/${task.id}`
                            : undefined;
                    const content = (
                        <>
                            <div className="text-xs z-10 self-center ml-2 relative h-4 grow mr-2">
                                <div className="absolute w-full h-4 whitespace-nowrap text-ellipsis overflow-hidden text-left">
                                    {task.title}
                                </div>
                            </div>
                            {!task.dueDateIsDefault && (
                                <div className="self-center text-xs flex justify-end mr-1.5 pl-1 z-10 text-ellipsis overflow-hidden whitespace-nowrap">
                                    {t("common.relativeDate", {
                                        value: task.dueDate,
                                        formatParams: { value: { style: "narrow", numeric: "auto" } },
                                    })}
                                </div>
                            )}
                        </>
                    );

                    return taskUrl ? (
                        <a
                            key={task.id}
                            href={taskUrl}
                            target={target}
                            rel="noopener noreferrer"
                            className={classNames(rowClassName, "hover:bg-theme-300/50 dark:hover:bg-theme-800/20")}
                        >
                            {content}
                        </a>
                    ) : (
                        <div key={task.id} className={rowClassName}>
                            {content}
                        </div>
                    );
                })}
        </>
    );
}
