import { resolve } from "path";

import { getEnv } from "@/utils/env";

// The config file is a Nunjucks template that renders to JSONC. Its object holds every config member.

export const DEFAULT_CONFIG_FILE = "foyer.config.jsonc.njk";

export const CONFIG_FILE = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    getEnv("CONFIG_FILE") || DEFAULT_CONFIG_FILE
);

export const CONFIG_NAMES = [
    "settings",
    "services",
    "bookmarks",
    "widgets",
    "docker",
    "kubernetes",
    "proxmox",
] as const;
export type ConfigName = (typeof CONFIG_NAMES)[number];

// The stylesheet and script the dashboard loads, served by /api/config/<file> from these string members
export const CUSTOM_FILES = ["custom.css", "custom.js"] as const;
export type CustomFile = (typeof CUSTOM_FILES)[number];

export const CUSTOM_FILE_MEMBERS = { "custom.css": "customCss", "custom.js": "customJs" } as const;
export type CustomMember = (typeof CUSTOM_FILE_MEMBERS)[CustomFile];

export type ConfigMember = ConfigName | CustomMember;
export const CONFIG_MEMBERS: readonly ConfigMember[] = [...CONFIG_NAMES, ...Object.values(CUSTOM_FILE_MEMBERS)];

// A top-level key editors read to find the JSON Schema; the loader skips it
export const SCHEMA_KEY = "$schema";

// What went wrong while loading. `config` is the member that failed, or "file" when the whole file did not load.
export type ConfigLoadError = { config: string; name: string; reason: string };

export type ConfigValues = Partial<Record<ConfigMember, unknown>>;

// The loaded config: its member values, what failed, and a hash of the values that changes whenever they do
export type LoadedConfig = { values: ConfigValues; errors: ConfigLoadError[]; hash: string };
