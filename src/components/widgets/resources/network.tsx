import { useTranslation } from "next-i18next/pages";
import { FaNetworkWired } from "react-icons/fa";
import useSWR from "swr";

import type { NetworkData, ResourcesOptions } from "@/components/widgets/resources/types";
import Error from "@/components/widgets/widget/error";
import Resource from "@/components/widgets/widget/resource";

type NetworkProps = {
    options: ResourcesOptions;
    refresh?: number;
};

export default function Network({ options, refresh = 1500 }: NetworkProps) {
    const { t } = useTranslation();
    const network = options.network === true ? "default" : options.network;

    const { data, error } = useSWR<NetworkData>(`/api/widgets/resources?type=network&interfaceName=${network}`, {
        refreshInterval: refresh,
    });

    if (error || data?.error) {
        return <Error />;
    }

    if (!data || !data.network || !data.network.rx_sec || !data.network.tx_sec) {
        return (
            <Resource
                icon={FaNetworkWired}
                value="- ↑"
                label="- ↓"
                expandedValue="- ↑"
                expandedLabel="- ↓"
                percentage="0"
                wide
            />
        );
    }

    return (
        <Resource
            icon={FaNetworkWired}
            value={`${t("common.byterate", { value: data.network.tx_sec })} ↑`}
            label={`${t("common.byterate", { value: data.network.rx_sec })} ↓`}
            expandedValue={`${t("common.bytes", { value: data.network.tx_bytes })} ↑`}
            expandedLabel={`${t("common.bytes", { value: data.network.rx_bytes })} ↓`}
            expanded={options.expanded}
            wide
            percentage={(100 * data.network.rx_sec) / (data.network.rx_sec + data.network.tx_sec)}
        />
    );
}
