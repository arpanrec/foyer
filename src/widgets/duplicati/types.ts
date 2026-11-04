import type { WidgetConfig } from "@/types/service";

// The config may give a password as a number
export type DuplicatiWidget = Omit<WidgetConfig, "password"> & { password?: string | number | undefined };

export type DuplicatiBackup = {
    Backup?: {
        Metadata?: {
            LastBackupFinished?: string | undefined;
            TargetFilesSize?: string | number | undefined;
        };
    };
    Schedule?: { Time?: string | undefined };
};

export type DuplicatiNotification = {
    BackupID?: unknown;
    Type?: string | undefined;
};

export type DuplicatiServerState = {
    ActiveTask?: unknown;
};

export type DuplicatiProgressState = {
    BackupID?: unknown;
};

export type DuplicatiLogin = {
    AccessToken?: string | undefined;
};

export type DuplicatiSummary = {
    jobs: number;
    stored: number;
    lastBackup: string | null;
    nextRun: string | null;
    running: number;
    warnings: number;
    errors: number;
};
