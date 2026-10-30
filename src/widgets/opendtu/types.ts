export type OpendtuValue = {
    v: number;
    u: string;
};

export type OpendtuData = {
    total: {
        YieldDay: OpendtuValue;
        Power: OpendtuValue;
    };
    inverters: { limit_absolute: number }[];
};
