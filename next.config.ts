import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    output: "standalone",
    // The App Router bundles server dependencies. These run on the server only and load native or
    // optional modules at runtime, so they stay in node_modules as they did for Pages Router API routes.
    serverExternalPackages: [
        "@kubernetes/client-node",
        "dockerode",
        "follow-redirects",
        "gamedig",
        "js-yaml",
        "json-rpc-2.0",
        "memory-cache",
        "minecraftstatuspinger",
        "ping",
        "raw-body",
        "sax",
        "systeminformation",
        "tough-cookie",
        "urbackup-server-api",
        "winston",
        "ws",
        "xml-js",
    ],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.jsdelivr.net",
            },
        ],
        unoptimized: true,
    },
};

export default nextConfig;
