export type PhotoprismCount = {
    albums: number;
    photos: number;
    videos: number;
    people: number;
};

export type PhotoprismSession = {
    config?: { count?: PhotoprismCount };
};
