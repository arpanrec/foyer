import classNames from "classnames";
import { useContext } from "react";

import { TabContext } from "@/utils/contexts/tab";

function slugify(tabName: string | number) {
    return tabName.toString().replace(/\s+/g, "-").toLowerCase();
}

export function slugifyAndEncode(tabName?: string | number) {
    return tabName !== undefined ? encodeURIComponent(slugify(tabName)) : "";
}

type TabProps = {
    tab: string;
};

export default function Tab({ tab }: TabProps) {
    const { activeTab, setActiveTab } = useContext(TabContext);

    const matchesTab = decodeURIComponent(String(activeTab)) === slugify(tab);

    return (
        <li
            key={tab}
            role="presentation"
            className={classNames("text-theme-700 dark:text-theme-200 relative h-10 w-full rounded-md flex")}
        >
            <button
                id={`${tab}-tab`}
                type="button"
                role="tab"
                aria-controls={`#${tab}`}
                aria-selected={matchesTab ? "true" : "false"}
                className={classNames(
                    "w-full rounded-md m-1",
                    matchesTab ? "bg-theme-300/20 dark:bg-white/10" : "hover:bg-theme-100/20 dark:hover:bg-white/5"
                )}
                onClick={() => {
                    setActiveTab(slugifyAndEncode(tab));
                    window.location.hash = `#${slugifyAndEncode(tab)}`;
                }}
            >
                {tab}
            </button>
        </li>
    );
}
