import type { WidgetProps } from "@/types/service";
import Interface from "@/widgets/openwrt/methods/interface";
import System from "@/widgets/openwrt/methods/system";
import type { OpenwrtOptions } from "@/widgets/openwrt/types";

export default function Component({ service }: WidgetProps<OpenwrtOptions>) {
    if (service.widget.interfaceName) {
        return <Interface service={service} />;
    }
    return <System service={service} />;
}
