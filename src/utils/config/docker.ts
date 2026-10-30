import { readFileSync } from "fs";
import path from "path";

import type Docker from "dockerode";

import checkAndCopyConfig, { CONF_DIR, substituteEnvironmentVars } from "@/utils/config/config";
import { isRecord, type DockerServersConfig } from "@/utils/config/types";
import { loadYaml } from "@/utils/config/yaml";

export function getDefaultDockerArgs(platform = process.platform) {
    if (platform !== "win32" && platform !== "darwin") {
        return { socketPath: "/var/run/docker.sock" };
    }

    return { host: "127.0.0.1" };
}

type DockerArguments = { conn?: Docker.DockerOptions; swarm?: boolean };

export default function getDockerArguments(): ReturnType<typeof getDefaultDockerArgs>;
export default function getDockerArguments(server: string): DockerArguments | null;
export default function getDockerArguments(
    server?: string
): ReturnType<typeof getDefaultDockerArgs> | DockerArguments | null {
    checkAndCopyConfig("docker.yaml");

    const configFile = path.join(CONF_DIR, "docker.yaml");
    const rawConfigData = readFileSync(configFile, "utf8");
    const configData = substituteEnvironmentVars(rawConfigData);
    const loaded = loadYaml(configData);
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
                res.conn.ca = readFileSync(path.join(CONF_DIR, servers[server].tls.caFile));
                res.conn.cert = readFileSync(path.join(CONF_DIR, servers[server].tls.certFile));
                res.conn.key = readFileSync(path.join(CONF_DIR, servers[server].tls.keyFile));
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
