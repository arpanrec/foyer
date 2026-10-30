export type GamedigOptions = {
    serverType?: string;
    gameToken?: string;
};

export type GamedigStatus = {
    online: boolean;
    name?: string;
    map?: string;
    players?: number;
    maxplayers?: number;
    bots?: number;
    ping?: number;
};
