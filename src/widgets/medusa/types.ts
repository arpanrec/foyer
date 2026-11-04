export type MedusaStats = {
    data: {
        ep_snatched: number;
        shows_active: number;
    };
};

export type MedusaFuture = {
    data: {
        later: unknown[];
        missed: unknown[];
        soon: unknown[];
        today: unknown[];
    };
};
