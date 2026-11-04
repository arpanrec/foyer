export type OpenwrtOptions = {
    interfaceName?: string;
};

// What the proxy answers with for an interface widget and for a system widget
export type OpenwrtInterface = {
    up: boolean;
    bytesRx: number;
    bytesTx: number;
};

export type OpenwrtSystem = {
    uptime: number;
    cpuLoad: string;
};

// ubus replies are `[status, result]`
export type OpenwrtLoginReply = [unknown, { ubus_rpc_session: string }];

export type OpenwrtDeviceStatus = {
    up: boolean;
    statistics: { rx_bytes: number; tx_bytes: number };
};

export type OpenwrtDevicesReply = [unknown, Record<string, OpenwrtDeviceStatus | undefined>];

export type OpenwrtSystemReply = [unknown, { uptime: number; load: number[] }];

export type OpenwrtErrorReply = {
    error?: { code?: number };
};
