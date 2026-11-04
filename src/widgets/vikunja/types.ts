export type VikunjaOptions = {
    version?: number | undefined;
    enableTaskList?: boolean | undefined;
    url?: string | undefined;
};

export type VikunjaProject = {
    id: number;
};

export type VikunjaRawTask = {
    id: number;
    title: string;
    priority?: number;
    due_date: string;
    percent_done: number;
};

export type VikunjaTask = {
    id: number;
    title: string;
    priority?: number;
    dueDate: string;
    dueDateIsDefault: boolean;
    inProgress: boolean;
};

// An error body carries `message` instead of the list
export type VikunjaList<T> = T[] & { message?: string };
