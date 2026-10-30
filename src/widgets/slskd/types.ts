export type SlskdApplication = {
    server?: { isConnected?: boolean };
    version?: { isUpdateAvailable?: boolean };
    shares?: { files?: number };
};

// The downloads and uploads endpoints each answer with a list of transfers; only the count is read
export type SlskdTransfers = unknown[];
