export type CloudflaredTunnel = {
    result: { status: string };
};

export type CloudflaredConnection = {
    origin_ip?: string;
};

export type CloudflaredConnections = {
    result: { conns?: CloudflaredConnection[] }[];
};
