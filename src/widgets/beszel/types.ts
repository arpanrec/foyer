export type BeszelOptions = {
    systemId?: string;
    version?: number;
};

export type BeszelSystem = {
    id: string;
    name: string;
    status: string;
    updated: number;
    info: {
        cpu: number;
        mp: number;
        dp: number;
        bb: number;
    };
};

export type BeszelSystems = {
    items?: BeszelSystem[];
    totalItems: number;
};

export type BeszelAuthReply = {
    token?: string;
};
