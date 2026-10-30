import { Disclosure, Transition } from "@headlessui/react";
import classNames from "classnames";
import { useEffect, useRef } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";

import List from "@/components/bookmarks/list";
import ErrorBoundary from "@/components/errorboundry";
import ResolvedIcon from "@/components/resolvedicon";
import type { BookmarkGroup, GroupLayout } from "@/components/types";
import setElementHeight from "@/utils/set-element-height";

type BookmarksGroupProps = {
    bookmarks: BookmarkGroup;
    layout?: GroupLayout;
    disableCollapse?: boolean;
    groupsInitiallyCollapsed?: boolean;
    bookmarksStyle?: string;
    maxGroupColumns?: number | string;
};

export default function BookmarksGroup({
    bookmarks,
    layout,
    disableCollapse,
    groupsInitiallyCollapsed,
    bookmarksStyle,
    maxGroupColumns,
}: BookmarksGroupProps) {
    const panel = useRef<HTMLElement>(null);

    useEffect(() => {
        if (layout?.initiallyCollapsed ?? groupsInitiallyCollapsed) setElementHeight(panel.current, `0`);
    }, [layout, groupsInitiallyCollapsed]);

    return (
        <div
            key={bookmarks.name}
            className={classNames(
                "bookmark-group flex-1 overflow-hidden",
                layout?.style === "row" ? "basis-full" : "basis-full md:basis-1/4 lg:basis-1/5 xl:basis-1/6",
                layout?.style !== "row" && maxGroupColumns && parseInt(String(maxGroupColumns), 10) > 6
                    ? `3xl:basis-1/${maxGroupColumns}`
                    : "",
                layout?.header === false ? "px-1" : "p-1 pb-0"
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
                                    <div className="shrink-0 mr-2 w-7 h-7 bookmark-group-icon">
                                        <ResolvedIcon icon={layout.icon} />
                                    </div>
                                )}
                                <h2 className="text-theme-800 dark:text-theme-300 text-xl font-medium bookmark-group-name">
                                    {bookmarks.name}
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
                            }}
                        >
                            <Disclosure.Panel
                                className="transition-all overflow-hidden duration-300 ease-out"
                                ref={panel}
                                static
                            >
                                <ErrorBoundary>
                                    <List
                                        bookmarks={bookmarks.bookmarks}
                                        layout={layout}
                                        bookmarksStyle={bookmarksStyle}
                                    />
                                </ErrorBoundary>
                            </Disclosure.Panel>
                        </Transition>
                    </>
                )}
            </Disclosure>
        </div>
    );
}
