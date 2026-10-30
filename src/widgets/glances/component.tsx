import type { WidgetProps } from "@/types/service";
import Containers from "@/widgets/glances/metrics/containers";
import Cpu from "@/widgets/glances/metrics/cpu";
import Disk from "@/widgets/glances/metrics/disk";
import Fs from "@/widgets/glances/metrics/fs";
import GPU from "@/widgets/glances/metrics/gpu";
import Info from "@/widgets/glances/metrics/info";
import Memory from "@/widgets/glances/metrics/memory";
import Net from "@/widgets/glances/metrics/net";
import Process from "@/widgets/glances/metrics/process";
import Sensor from "@/widgets/glances/metrics/sensor";
import type { GlancesOptions } from "@/widgets/glances/types";

export default function Component({ service }: WidgetProps<GlancesOptions>) {
    const { widget } = service;
    const metric = widget.metric ?? "";

    if (metric === "info") {
        return <Info service={service} />;
    }

    if (metric === "memory") {
        return <Memory service={service} />;
    }

    if (metric === "process") {
        return <Process service={service} />;
    }

    if (metric === "containers") {
        return <Containers service={service} />;
    }

    if (metric === "cpu") {
        return <Cpu service={service} />;
    }

    if (metric.match(/^network:/)) {
        return <Net service={service} />;
    }

    if (metric.match(/^sensor:/)) {
        return <Sensor service={service} />;
    }

    if (metric.match(/^disk:/)) {
        return <Disk service={service} />;
    }

    if (metric.match(/^gpu:/)) {
        return <GPU service={service} />;
    }

    if (metric.match(/^fs:/)) {
        return <Fs service={service} />;
    }
}
