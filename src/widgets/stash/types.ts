export type StashStats = {
    scene_count: number;
    scenes_size: number;
    scenes_duration: number;
    image_count: number;
    images_size: number;
    gallery_count: number;
    performer_count: number;
    studio_count: number;
    movie_count: number;
    tag_count: number;
    total_o_count: number;
    total_play_duration: number;
    total_play_count: number;
    scenes_played: number;
};

export type StashGraphqlResponse = {
    data: { stats: StashStats };
};
