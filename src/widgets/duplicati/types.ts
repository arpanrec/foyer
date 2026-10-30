import type { WidgetConfig } from "@/types/service";

// YAML lets a password be a number
export type DuplicatiWidget = Omit<WidgetConfig, "password"> & { password?: string | number };

export type DuplicatiBackup = {
    Backup?: {
        Metadata?: {
            LastBackupFinished?: string;
            TargetFilesSize?: string | number;
        };
    };
    Schedule?: { Time?: string };
};

export type DuplicatiNotification = {
    BackupID?: unknown;
    Type?: string;
};

export type DuplicatiServerState = {
    ActiveTask?: unknown;
};

export type DuplicatiProgressState = {
    BackupID?: unknown;
};

export type DuplicatiLogin = {
    AccessToken?: string;
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
