// The XML responses are converted to JSON by xml-js (compact mode), so every value is wrapped in `_cdata` or `_text`.
export type QnapCdata = { _cdata: string };
export type QnapText = { _text: string };

export type QnapOptions = {
    volume?: string;
};

export type QnapSystem = {
    cpu_usage: QnapCdata;
    total_memory: QnapCdata;
    free_memory: QnapCdata;
    sys_tempc: QnapText;
};

export type QnapVolumeUse = {
    total_size: QnapCdata;
    free_size: QnapCdata;
};

export type QnapVolume = {
    volumeList: { volume: { volumeLabel: QnapCdata }[] };
    volumeUseList: { volumeUse: QnapVolumeUse | QnapVolumeUse[] };
};

// What the proxy returns and the component reads
export type QnapStatusData = {
    system: QnapSystem;
    volume: QnapVolume;
};

// The decoded `QDocRoot` of the login, sysinfo and disk usage calls
export type QnapDocument = {
    QDocRoot: Partial<QnapVolume> & {
        authSid?: QnapCdata;
        authPassed: QnapCdata;
        func?: { ownContent: { root: QnapSystem } };
    };
};
