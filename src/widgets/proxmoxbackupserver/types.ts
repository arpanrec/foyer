export type ProxmoxBackupServerOptions = {
    datastore?: string;
};

export type ProxmoxBackupServerDatastore = {
    store: string;
    used: number;
    total: number;
};

export type ProxmoxBackupServerDatastoreData = {
    data: ProxmoxBackupServerDatastore[];
};

export type ProxmoxBackupServerTasksData = {
    total: number;
};

export type ProxmoxBackupServerHostData = {
    data: {
        cpu: number;
        memory: { used: number; total: number };
    };
};
