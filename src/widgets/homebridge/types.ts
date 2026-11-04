export type HomebridgeLoginReply = {
    access_token: string;
    expires_in: number;
};

export type HomebridgeStatusResponse = {
    status?: string;
};

export type HomebridgeVersionResponse = {
    updateAvailable?: boolean;
};

export type HomebridgeChildBridge = {
    status?: string;
};

export type HomebridgePlugin = {
    updateAvailable?: boolean;
};

export type HomebridgeInfo = {
    status?: string;
    updateAvailable?: boolean;
    plugins?: {
        updatesAvailable?: number;
    };
    childBridges: {
        running?: number;
        total: number;
    };
};
