export type NtfyMessage = {
    title?: string | null;
    message?: string | null;
    priority: number;
    time?: number | null;
    tags?: string[];
};
