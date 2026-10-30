type TraefikTotal = {
    total: number;
};

export type TraefikOverview = {
    http: {
        routers: TraefikTotal;
        services: TraefikTotal;
        middlewares: TraefikTotal;
    };
};
