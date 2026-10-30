export type ChangedetectionioWatch = {
    last_changed: number;
    viewed?: boolean;
};

// Watches keyed by uuid
export type ChangedetectionioWatches = Record<string, ChangedetectionioWatch>;
