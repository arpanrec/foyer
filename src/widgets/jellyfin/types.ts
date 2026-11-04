export type JellyfinOptions = {
    version?: number;
    deviceId?: string;
    enableBlocks?: boolean;
    enableNowPlaying?: boolean;
    enableMediaControl?: boolean;
    enableUser?: boolean;
    expandOneStreamToTwoRows?: boolean;
    showEpisodeNumber?: boolean;
};

export type JellyfinNowPlayingItem = {
    Name?: string;
    SeriesName?: string;
    Type?: string;
    ParentIndexNumber?: number;
    IndexNumber?: number;
    AlbumArtist?: string;
    Album?: string;
    RunTimeTicks?: number;
    CurrentProgram?: { RunTimeTicks?: number };
};

export type JellyfinTranscodingInfo = {
    IsVideoDirect?: boolean;
    VideoDecoderIsHardware?: boolean;
    VideoEncoderIsHardware?: boolean;
};

export type JellyfinSession = {
    Id: string;
    UserName?: string;
    NowPlayingItem?: JellyfinNowPlayingItem;
    PlayState: {
        PositionTicks: number;
        IsPaused?: boolean;
        IsMuted?: boolean;
    };
    TranscodingInfo?: JellyfinTranscodingInfo;
};

export type JellyfinPlayingSession = JellyfinSession & { NowPlayingItem: JellyfinNowPlayingItem };

export type JellyfinCount = {
    MovieCount: number;
    SeriesCount: number;
    EpisodeCount: number;
    SongCount: number;
    AlbumCount: number;
};
