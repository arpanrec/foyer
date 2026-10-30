export type DispatcharrOptions = {
    enableActiveStreams?: boolean;
};

export type DispatcharrChannels = unknown[];

export type DispatcharrActiveStream = {
    channel_name?: string;
    stream_name?: string;
    clients: unknown[];
    avg_bitrate?: string | number;
};

export type DispatcharrStreams = {
    count?: number;
    channels?: DispatcharrActiveStream[];
};

export type DispatcharrToken = {
    access?: string;
};

// A listing response; an empty `items` list means the token is no longer accepted
export type DispatcharrListing = {
    items?: unknown;
};
