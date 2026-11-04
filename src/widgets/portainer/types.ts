export type PortainerOptions = {
    kubernetes?: boolean;
};

// A count can come back as an error object, e.g. if the environment fails
export type PortainerCount = number | { error?: unknown; message?: string };

export type PortainerContainer = {
    State: string;
};

export type PortainerContainers = PortainerContainer[] | { error?: unknown; message?: string };
