export type HdhomerunOptions = {
    tuner?: number;
};

export type HdhomerunChannel = {
    HD?: number;
};

export type HdhomerunTunerStatus = {
    VctNumber?: string | number | null;
    VctName?: string | null;
    SignalStrengthPercent?: number | null;
    SignalQualityPercent?: number | null;
    SymbolQualityPercent?: number | null;
    TargetIP?: string | null;
    NetworkRate?: number | null;
};
