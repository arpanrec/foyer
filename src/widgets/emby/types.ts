export type EmbyOptions = {
    enableNowPlaying?: boolean;
    enableBlocks?: boolean;
    enableMediaControl?: boolean;
    enableUser?: boolean;
    expandOneStreamToTwoRows?: boolean;
    showEpisodeNumber?: boolean;
};

export type EmbyNowPlayingItem = {
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

export type EmbyTranscodingInfo = {
    IsVideoDirect?: boolean;
    VideoDecoderIsHardware?: boolean;
    VideoEncoderIsHardware?: boolean;
};

export type EmbySession = {
    Id: string;
    UserName?: string;
    NowPlayingItem?: EmbyNowPlayingItem;
    PlayState: {
        PositionTicks: number;
        IsPaused?: boolean;
        IsMuted?: boolean;
    };
    TranscodingInfo?: EmbyTranscodingInfo;
};

// A session that is playing something
export type EmbyPlayingSession = EmbySession & { NowPlayingItem: EmbyNowPlayingItem };

export type EmbyCounts = {
    MovieCount: number;
    SeriesCount: number;
    EpisodeCount: number;
    SongCount: number;
};

export type EmbyPlayCommand = (session: EmbySession, command: string) => Promise<void>;
