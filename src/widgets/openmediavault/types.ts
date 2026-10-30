export type OpenmediavaultDownload = {
    downloading?: boolean;
};

export type OpenmediavaultDownloadList = {
    response?: { data?: OpenmediavaultDownload[] };
};

export type OpenmediavaultService = {
    running?: boolean;
};

export type OpenmediavaultServiceStatus = {
    response?: { data?: OpenmediavaultService[] };
};

export type OpenmediavaultDisk = {
    monitor?: boolean;
    overallstatus?: string;
};

// The SMART list arrives as a background job whose output is a JSON string of `{ data: disks }`
export type OpenmediavaultSmartList = {
    response?: { output?: string };
};

export type OpenmediavaultRpcRequest = {
    service: string;
    method: string;
    params?: unknown;
};

// The reply to a login call, and the progress of a background job
export type OpenmediavaultSession = {
    response: { authenticated?: boolean; status?: string };
};

export type OpenmediavaultBgProgress = {
    response: { running?: boolean; outputPending?: boolean; pos: number };
};
