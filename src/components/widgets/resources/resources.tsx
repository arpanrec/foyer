import Cpu from "@/components/widgets/resources/cpu";
import CpuTemp from "@/components/widgets/resources/cputemp";
import Disk from "@/components/widgets/resources/disk";
import Memory from "@/components/widgets/resources/memory";
import Network from "@/components/widgets/resources/network";
import type { ResourcesOptions } from "@/components/widgets/resources/types";
import Uptime from "@/components/widgets/resources/uptime";
import Container from "@/components/widgets/widget/container";
import Raw from "@/components/widgets/widget/raw";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";

export default function Resources({ options }: InfoWidgetProps<ResourcesOptions>) {
    const { expanded, units, diskUnits, tempmin, tempmax } = options;
    let { refresh } = options;
    if (!refresh) refresh = 1500;
    refresh = Math.max(refresh, 1000);
    return (
        <Container options={options}>
            <Raw>
                <div className="flex flex-row self-center flex-wrap justify-between">
                    {options.cpu && <Cpu expanded={expanded} refresh={refresh} />}
                    {options.memory && <Memory expanded={expanded} refresh={refresh} />}
                    {Array.isArray(options.disk)
                        ? options.disk.map((disk) => (
                              <Disk
                                  key={disk}
                                  options={{ disk }}
                                  expanded={expanded}
                                  diskUnits={diskUnits}
                                  refresh={refresh}
                              />
                          ))
                        : options.disk && (
                              <Disk options={options} expanded={expanded} diskUnits={diskUnits} refresh={refresh} />
                          )}
                    {options.network && <Network options={options} refresh={refresh} />}
                    {options.cputemp && (
                        <CpuTemp
                            expanded={expanded}
                            units={units}
                            refresh={refresh}
                            tempmin={tempmin}
                            tempmax={tempmax}
                        />
                    )}
                    {options.uptime && <Uptime refresh={refresh} />}
                </div>
                {options.label && (
                    <div className="ml-6 pt-1 text-center text-theme-800 dark:text-theme-200 text-xs">
                        {options.label}
                    </div>
                )}
            </Raw>
        </Container>
    );
}
