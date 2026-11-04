export type MyspeedTest = {
    download: number;
    upload: number;
    ping: number;
    error?: string;
};

// The latest speed tests, or an object carrying `message` when MySpeed rejects the call
export type MyspeedData = MyspeedTest[] | { message?: string };
