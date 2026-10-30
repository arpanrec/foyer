export type UrbackupOptions = {
    maxDays?: number;
};

export type UrbackupClient = {
    lastbackup: number;
    lastbackup_image: number;
    image_not_supported?: boolean;
    image_disabled?: boolean;
    file_ok?: boolean;
    image_ok?: boolean;
};

export type UrbackupStatus = {
    clientStatuses: UrbackupClient[];
    diskUsage: { used: number }[] | false;
    maxDays?: number;
};
