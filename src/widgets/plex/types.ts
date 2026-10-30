export type PlexLibrary = {
    _attributes: { type: string; key: string };
};

export type PlexMediaContainer = {
    _attributes: Record<string, string>;
    Directory?: PlexLibrary | PlexLibrary[];
};

export type PlexApiData = {
    MediaContainer?: PlexMediaContainer;
};

export type PlexCounts = {
    streams?: string;
    albums: number;
    movies: number;
    tv: number;
};
