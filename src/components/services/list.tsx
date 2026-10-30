import classNames from "classnames";

import Item from "@/components/services/item";
import type { GroupLayout } from "@/components/types";
import type { Service } from "@/types/service";
import { columnMap } from "@/utils/layout/columns";

type ListProps = {
    groupName: string;
    services: Service[];
    layout?: GroupLayout;
    useEqualHeights?: boolean;
    header?: boolean;
};

export default function List({ groupName, services, layout, useEqualHeights, header }: ListProps) {
    return (
        <ul
            className={classNames(
                layout?.style === "row" ? `grid ${columnMap[layout?.columns ?? -1]} gap-x-2` : "flex flex-col",
                header ? "mt-3" : "",
                "services-list"
            )}
        >
            {services.map((service) => (
                <Item
                    key={[service.container, service.app, service.name].filter((s) => s).join("-")}
                    service={service}
                    groupName={groupName}
                    useEqualHeights={layout?.useEqualHeights ?? useEqualHeights}
                />
            ))}
        </ul>
    );
}
