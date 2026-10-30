export type SpoolmanOptions = {
    spoolIds?: number[];
};

// The API answers an error with an object that has a `message` instead of the spool list
export type SpoolmanSpools = SpoolmanSpool[] & { message?: string };

export type SpoolmanSpool = {
    id: number;
    filament: { name: string };
    remaining_weight: number;
    initial_weight: number;
};
