export type PterodactylNode = {
    attributes?: {
        relationships?: {
            servers?: { data?: unknown[] };
        };
    };
};

export type PterodactylNodesData = {
    data: PterodactylNode[];
};
