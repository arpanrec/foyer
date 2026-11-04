export type KomgaOptions = {
    version?: number;
};

export type KomgaLibrary = {
    unavailable?: boolean;
};

export type KomgaPage = {
    totalElements: number;
};

export type KomgaData = {
    libraries: KomgaLibrary[];
    series: KomgaPage;
    books: KomgaPage;
};
