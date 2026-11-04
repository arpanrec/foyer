import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

export type KubernetesNodeOptions = {
    show?: boolean;
    showLabel?: boolean;
    label?: string;
};

export type KubernetesOptions = InfoWidgetBaseOptions & {
    cluster?: KubernetesNodeOptions;
    nodes?: KubernetesNodeOptions;
};

export type KubernetesUsage = {
    cpu: { total: number; load: number; percent: number };
    memory: { total: number; used: number; free: number; percent: number };
};

// A node before the metrics server has reported usage for it
export type KubernetesNodeCapacity = {
    name: string;
    ready: boolean;
    cpu: { total: number; load?: number; percent?: number };
    memory: { total: number; used?: number; free?: number; percent?: number };
};

export type KubernetesData = {
    error?: unknown;
    cluster: KubernetesUsage;
    nodes?: KubernetesNodeCapacity[];
};

// What a node card reads: the cluster totals, or one node's entry
export type KubernetesNodeData = {
    name?: string;
    ready?: boolean;
    cpu?: { percent?: number };
    memory?: { free?: number; percent?: number };
};
