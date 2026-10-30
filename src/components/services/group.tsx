import { Disclosure, Transition } from "@headlessui/react";
import classNames from "classnames";
import { useEffect, useRef } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";

import ResolvedIcon from "@/components/resolvedicon";
import List from "@/components/services/list";
import type { GroupLayout } from "@/components/types";
import type { ServiceGroup } from "@/types/service";
import { columnMap } from "@/utils/layout/columns";
import setElementHeight from "@/utils/set-element-height";

type ServicesGroupProps = {
    group: ServiceGroup;
    layout?: GroupLayout;
    maxGroupColumns?: number | string;
    disableCollapse?: boolean;
    useEqualHeights?: boolean;
    groupsInitiallyCollapsed?: boolean;
    isSubgroup?: boolean;
};

export default function ServicesGroup({
    group,
    layout,
    maxGroupColumns,
    disableCollapse,
    useEqualHeights,
    groupsInitiallyCollapsed,
    isSubgroup,
}: ServicesGroupProps) {
    const panel = useRef<HTMLElement>(null);

    useEffect(() => {
        if (layout?.initiallyCollapsed ?? groupsInitiallyCollapsed) setElementHeight(panel.current, `0`);
    }, [layout, groupsInitiallyCollapsed]);

    let groupPadding = layout?.header === false ? "px-1" : "p-1 pb-0";
    if (isSubgroup) groupPadding = "";

    return (
        <div
            key={group.name}
            className={classNames(
                "services-group flex-1",
                layout?.style === "row" ? "basis-full" : "basis-full md:basis-1/2 lg:basis-1/3 xl:basis-1/4",
                layout?.style !== "row" && maxGroupColumns ? `3xl:basis-1/${maxGroupColumns}` : "",
                groupPadding,
                isSubgroup ? "subgroup" : ""
            )}
        >
            <Disclosure defaultOpen={!(layout?.initiallyCollapsed ?? groupsInitiallyCollapsed)}>
                {({ open }) => (
                    <>
                        {layout?.header !== false && (
                            <Disclosure.Button
                                disabled={disableCollapse}
                                className="flex w-full select-none items-center group"
                            >
                                {layout?.icon && (
                                    <div className="shrink-0 mr-2 w-7 h-7 service-group-icon">
                                        <ResolvedIcon icon={layout.icon} />
                                    </div>
                                )}
                                <h2 className="flex text-theme-800 dark:text-theme-300 text-xl font-medium service-group-name">
                                    {group.name}
                                </h2>
                                <MdKeyboardArrowDown
                                    className={classNames(
                                        disableCollapse ? "hidden" : "",
                                        "transition-all opacity-0 group-hover:opacity-100 ml-auto text-theme-800 dark:text-theme-300 text-xl",
                                        open ? "" : "rotate-180"
                                    )}
                                />
                            </Disclosure.Button>
                        )}
                        <Transition
                            // Otherwise the transition group does display: none and cancels animation
                            // @ts-expect-error Headless UI passes className to the child, its Fragment typing omits it
                            className="block!"
                            unmount={false}
                            beforeLeave={() => {
                                setElementHeight(panel.current, `${panel.current?.scrollHeight}px`);
                                setTimeout(() => {
                                    setElementHeight(panel.current, `0`);
                                }, 1);
                            }}
                            beforeEnter={() => {
                                setElementHeight(panel.current, `0px`);
                                setTimeout(() => {
                                    setElementHeight(panel.current, `${panel.current?.scrollHeight}px`);
                                }, 1);
                                setTimeout(() => {
                                    setElementHeight(panel.current, "auto");
                                }, 150); // animation is 150ms
                            }}
                        >
                            <Disclosure.Panel
                                className="transition-all overflow-hidden duration-300 ease-out"
                                ref={panel}
                                static
                            >
                                <List
                                    groupName={group.name}
                                    services={group.services}
                                    layout={layout}
                                    useEqualHeights={useEqualHeights}
                                    header={layout?.header !== false}
                                />
                                {group.groups && group.groups.length > 0 && (
                                    <div
                                        className={`grid ${
                                            layout?.style === "row"
                                                ? `grid ${columnMap[layout?.columns ?? -1]} gap-x-2`
                                                : "flex flex-col"
                                        } gap-2`}
                                    >
                                        {group.groups.map((subgroup) => (
                                            <ServicesGroup
                                                key={subgroup.name}
                                                group={subgroup}
                                                layout={layout?.[subgroup.name] as GroupLayout | undefined}
                                                maxGroupColumns={maxGroupColumns}
                                                disableCollapse={disableCollapse}
                                                useEqualHeights={useEqualHeights}
                                                groupsInitiallyCollapsed={groupsInitiallyCollapsed}
                                                isSubgroup
                                            />
                                        ))}
                                    </div>
                                )}
                            </Disclosure.Panel>
                        </Transition>
                    </>
                )}
            </Disclosure>
        </div>
    );
}
