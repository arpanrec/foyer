import type { DateTime } from "luxon";
import type { Dispatch, SetStateAction } from "react";

export type CalendarEvent = {
    title: string;
    date: DateTime;
    color: string;
    isCompleted?: boolean;
    additional?: string | null;
    url?: string | null;
    type?: string;
};

export type CalendarEventsMap = Record<string, CalendarEvent>;

export type CalendarIntegration = {
    type?: string;
    name?: string;
    url?: string;
    baseUrl?: string;
    color?: string;
    service_name?: string;
    service_group?: string;
    index?: number | string;
    params?: {
        showName?: boolean;
        unmonitored?: boolean;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export type CalendarOptions = {
    integrations?: CalendarIntegration[];
    firstDayInWeek?: string;
    view?: string;
    maxEvents?: number;
    previousDays?: number;
    showTime?: boolean;
    timezone?: string;
};

export type IntegrationProps = {
    config: CalendarIntegration;
    params: {
        start: string;
        end: string;
        unmonitored?: boolean;
    };
    setEvents: Dispatch<SetStateAction<CalendarEventsMap>>;
    hideErrors?: boolean;
    timezone?: string;
    className?: string;
};

export type SonarrRelease = {
    title?: string;
    seasonNumber: number;
    episodeNumber: number;
    airDateUtc: string;
    hasFile?: boolean;
    series: {
        title?: string;
        titleSlug?: string;
    };
};

export type RadarrRelease = {
    title: string;
    titleSlug?: string;
    hasFile?: boolean;
    inCinemas?: string;
    physicalRelease?: string;
    digitalRelease?: string;
};

export type LidarrRelease = {
    title: string;
    releaseDate: string;
    grabbed?: boolean;
    artist: {
        artistName: string;
    };
};

export type ReadarrRelease = {
    title: string;
    seriesTitle?: string;
    releaseDate: string;
    grabbed?: boolean;
    author?: {
        authorName?: string;
    };
    authorTitle: string;
};

export type IcalResponse = {
    data?: string;
};
