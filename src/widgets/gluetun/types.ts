export type GluetunOptions = {
    version?: number;
};

export type GluetunIpData = {
    public_ip: string;
    region?: string;
    country: string;
};

export type GluetunPortForwardedData = {
    port: number;
};
