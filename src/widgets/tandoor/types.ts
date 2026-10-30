export type TandoorSpace = {
    user_count?: number;
    recipe_count?: number;
};

// The spaces come as a plain list or as a paginated list
export type TandoorSpaces = TandoorSpace[] | { results?: TandoorSpace[] };

export type TandoorKeywords = {
    count?: number;
};
