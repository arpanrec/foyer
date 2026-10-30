export type AuthentikOptions = {
    // service-helpers sets the version to null when the key is absent
    version?: number | null;
};

export type AuthentikUsers = {
    pagination: { count: number };
};

// A point of the per-month event series (v1)
export type AuthentikLoginPoint = {
    x_cord: number;
    y_cord: number;
};

export type AuthentikEvent = {
    action?: string;
    count?: number;
};
