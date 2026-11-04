export type EvccData = {
    pvPower?: number;
    gridPower?: number;
    // gridPower moved under `grid.power` in evcc v0.133.0
    grid?: { power?: number };
    homePower?: number;
    loadpoints?: { chargePower?: number }[];
};

// evcc v0.207 moved the data out from under `result`
export type EvccState = EvccData & {
    result?: EvccData;
};
