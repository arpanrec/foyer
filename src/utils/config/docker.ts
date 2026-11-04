import { readFileSync } from "fs";

import type Docker from "dockerode";

import { getConfig } from "@/utils/config/store";
import { isRecord, type DockerServersConfig } from "@/utils/config/types";

export function getDefaultDockerArgs(platform = process.platform) {
    if (platform !== "win32" && platform !== "darwin") {
        return { socketPath: "/var/run/docker.sock" };
    }

    return { host: "127.0.0.1" };
}

type DockerArguments = { conn?: Docker.DockerOptions | undefined; swarm?: boolean | undefined };

export default async function getDockerArguments(): Promise<ReturnType<typeof getDefaultDockerArgs>>;
export default async function getDockerArguments(server: string): Promise<DockerArguments | null>;
export default async function getDockerArguments(
    server?: string
): Promise<ReturnType<typeof getDefaultDockerArgs> | DockerArguments | null> {
    const loaded = await getConfig("docker");
    const servers = (isRecord(loaded) ? loaded : {}) as DockerServersConfig;

    if (!server) {
        return getDefaultDockerArgs();
    }

    if (servers[server]) {
        if (servers[server].socket) {
            return { conn: { socketPath: servers[server].socket }, swarm: !!servers[server].swarm };
        }

        if (servers[server].host) {
            const res: { conn: Docker.DockerOptions; swarm: boolean } = {
                conn: { host: servers[server].host },
                swarm: !!servers[server].swarm,
            };

            if (servers[server].port) {
                res.conn.port = servers[server].port;
            }

            if (servers[server].tls) {
                // opened as written, so a relative path is read from the working directory
                res.conn.ca = readFileSync(servers[server].tls.caFile);
                res.conn.cert = readFileSync(servers[server].tls.certFile);
                res.conn.key = readFileSync(servers[server].tls.keyFile);
                res.conn.protocol = "https";
            }

            if (servers[server].protocol) {
                res.conn.protocol = servers[server].protocol;
            }

            if (servers[server].headers) {
                res.conn.headers = servers[server].headers;
            }

            return res;
        }

        return servers[server];
    }
    return null;
}
