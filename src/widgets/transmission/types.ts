export type TransmissionTorrent = {
    rateDownload: number;
    rateUpload: number;
    percentDone: number;
};

export type TransmissionTorrents = {
    arguments: {
        torrents: TransmissionTorrent[];
    };
};
