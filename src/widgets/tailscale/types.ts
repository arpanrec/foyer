export type TailscaleDevice = {
    message?: string;
    addresses: string[];
    keyExpiryDisabled?: boolean;
    lastSeen: string;
    expires: string;
    user?: string;
    hostname?: string;
    name?: string;
    clientVersion?: string | number;
    os?: string;
    created?: string;
    authorized?: boolean;
    isExternal?: boolean;
    updateAvailable?: boolean;
    tags?: string[];
};
