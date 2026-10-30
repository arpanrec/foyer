export type JdownloaderOptions = {
    client?: string;
};

// A decrypted JDownloader API reply; `rid` is echoed back, `sessiontoken` comes from the login call
export type JdownloaderReply = {
    rid: number;
    sessiontoken: string;
};

export type JdownloaderDevice = {
    id: string;
    name: string;
};

export type JdownloaderDeviceList = {
    list: JdownloaderDevice[];
};

export type JdownloaderPackage = {
    bytesTotal: number;
    bytesLoaded: number;
    finished?: boolean;
    speed?: number;
};

export type JdownloaderPackagesReply = {
    data: JdownloaderPackage[];
};

export type JdownloaderSummary = {
    downloadCount: number;
    bytesRemaining: number;
    totalBytes: number;
    totalSpeed: number;
};
