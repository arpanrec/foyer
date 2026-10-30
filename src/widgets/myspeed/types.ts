export type MyspeedTest = {
    download: number;
    upload: number;
    ping: number;
    error?: string;
};

// The latest speed tests; a failed call answers with an object carrying `message` instead
export type MyspeedData = MyspeedTest[] & { message?: string };
