export type TautulliOptions = {
    enableUser?: boolean;
    expandOneStreamToTwoRows?: boolean;
    showEpisodeNumber?: boolean;
};

export type TautulliSession = {
    session_key: string | number;
    media_type?: string;
    parent_media_index: number;
    media_index: number;
    title?: string;
    grandparent_title?: string;
    full_title: string;
    friendly_name?: string;
    duration: number;
    view_offset: number;
    progress_percent: number | string;
    state?: string;
    video_decision?: string;
    audio_decision?: string;
};

export type TautulliActivity = {
    response: {
        data: {
            sessions: TautulliSession[];
        };
    };
};
