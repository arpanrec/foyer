export type VikunjaOptions = {
    version?: number;
    enableTaskList?: boolean;
    url?: string;
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
