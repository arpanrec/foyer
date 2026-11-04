import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    // Stops `next dev` from writing agent rules into the project.
    agentRules: false,
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    // The Docker image runs the standalone server. The npm package runs the regular build through the foyer
    // command, which sets FOYER_NPM_PACKAGE, as does `pnpm pack` when it builds the package.
    ...(process.env["FOYER_NPM_PACKAGE"] === "true" ? {} : { output: "standalone" }),
    // The App Router bundles server dependencies. These run on the server only and load native or
    // optional modules at runtime, so they stay in node_modules.
    serverExternalPackages: [
        "@kubernetes/client-node",
        "dockerode",
        "follow-redirects",
        "gamedig",
        "json-rpc-2.0",
        "nunjucks",
        "ping",
        "raw-body",
        "sax",
        "systeminformation",
        "tough-cookie",
        "urbackup-server-api",
        "winston",
        "ws",
    ],
    // Icons come from /api/icons and /api/icon-proxy, whose URLs carry a query string
    images: {
        localPatterns: [{ pathname: "/**" }],
        unoptimized: true,
    },
};

export default nextConfig;
