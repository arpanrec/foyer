export type HeadscaleOptions = {
    nodeId?: string | number;
};

export type HeadscaleNodeResponse = {
    node: {
        givenName: string;
        ipAddresses: string[];
        lastSeen: string | number;
        online: boolean;
    };
};
