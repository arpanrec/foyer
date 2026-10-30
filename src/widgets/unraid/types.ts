export type UnraidCache = {
    name: string;
    fsType?: string;
    fsSize: number;
    fsFree: number;
    fsUsed: number;
};

export type UnraidGraphqlResponse = {
    data?: {
        array?: {
            state?: string;
            capacity?: {
                kilobytes?: { free: number; total: number; used: number };
            };
            caches?: UnraidCache[];
        };
        metrics?: {
            memory?: { active?: number; available?: number; percentTotal?: number };
            cpu?: { percentTotal?: number };
        };
        notifications?: {
            overview?: { unread?: { total?: number } };
        };
    };
};

export type UnraidCacheStats = {
    fsFree: number;
    fsUsed: number;
    fsUsedPercent: number;
};

export type UnraidStats = {
    memoryUsedPercent?: number | null;
    memoryUsed?: number | null;
    memoryAvailable?: number | null;
    cpuPercent?: number | null;
    unreadNotifications?: number | null;
    arrayState?: string | null;
    arrayFree?: number;
    arrayUsed?: number;
    arrayUsedPercent?: number;
    caches: Record<string, UnraidCacheStats>;
};

export type UnraidOptions = {
    pool1?: string;
    pool2?: string;
    pool3?: string;
    pool4?: string;
};
