import classNames from "classnames";
import { DateTime } from "luxon";
import { useTranslation } from "next-i18next/pages";

import Event, { compareDateTimezone } from "@/widgets/calendar/event";
import type { CalendarEventsMap, CalendarOptions } from "@/widgets/calendar/types";

type AgendaProps = {
    service: { widget?: CalendarOptions };
    colorVariants: Record<string, string>;
    events: CalendarEventsMap;
    showDate: DateTime | null;
    setShowDate?: (date: DateTime) => void;
    className?: string;
};

export default function Agenda({ service, colorVariants, events, showDate }: AgendaProps) {
    const { widget } = service;
    const { t } = useTranslation();

    if (!showDate) {
        return <div className=" text-center" />;
    }

    const eventsArray = Object.keys(events)
        .filter(
            (eventKey) =>
                showDate
                    .minus({ days: widget?.previousDays ?? 0 })
                    .startOf("day")
                    .toMillis() <= events[eventKey].date?.startOf("day").toMillis()
        )
        .map((eventKey) => events[eventKey])
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())
        .slice(0, widget?.maxEvents ?? 10);

    if (!eventsArray.length) {
        return (
            <div className="text-center">
                <div className="pl-2 pr-2">
                    <div
                        className={classNames(
                            "flex flex-col",
                            !eventsArray.length && !Object.keys(events).length && "animate-pulse"
                        )}
                    >
                        <Event
                            key="no-event"
                            event={{
                                title: t("calendar.noEventsToday"),
                                date: DateTime.now(),
                                color: "gray",
                            }}
                            colorVariants={colorVariants}
                        />
                    </div>
                </div>
            </div>
        );
    }

    const days = Array.from(new Set(eventsArray.map((e) => e.date.startOf("day").toMillis())));
    const eventsByDay = days.map((d) => eventsArray.filter((e) => e.date.startOf("day").toMillis() === d));

    return (
        <div className="pl-1 pr-1 pb-1">
            <div
                className={classNames(
                    "flex flex-col",
                    !eventsArray.length && !Object.keys(events).length && "animate-pulse"
                )}
            >
                {eventsByDay.map((eventsDay, i) => (
                    <div key={days[i]}>
                        {eventsDay.map((event, j) => (
                            <Event
                                key={`event-agenda-${event.title}-${event.date}-${event.additional}`}
                                event={event}
                                colorVariants={colorVariants}
                                showDate={j === 0}
                                showTime={widget?.showTime && compareDateTimezone(showDate, event)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
