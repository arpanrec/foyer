"use client";

import { useEffect } from "react";

import "@/styles/globals.css";
import { errorDigest, errorMessage } from "@/utils/error";

type GlobalErrorProps = {
    error: unknown;
    retry: () => void;
};

// Errors in the root layout bypass Providers and every React context it sets up, so this
// renders its own html/body and cannot use useTranslation, settings or theme classes.
export default function GlobalError({ error, retry }: GlobalErrorProps) {
    const message = errorMessage(error);
    const digest = errorDigest(error);

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="en">
            <body className="h-screen w-screen flex items-center justify-center bg-zinc-950 p-10 font-sans text-zinc-100">
                <div className="max-w-md w-full rounded-md shadow-md font-mono">
                    <div className="bg-rose-800 text-rose-100 p-2 rounded-t-md font-bold">Something went wrong</div>
                    <div className="bg-rose-950 text-rose-100 p-3 rounded-b-md flex flex-col gap-2">
                        {message && <p className="text-sm break-words">{message}</p>}
                        {digest && <p className="text-xs opacity-70">Reference: {digest}</p>}
                        <button
                            type="button"
                            onClick={() => retry()}
                            className="self-start rounded bg-rose-800 px-3 py-1.5 text-sm font-medium hover:bg-rose-700"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
