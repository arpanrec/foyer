import classNames from "classnames";
import type { CSSProperties } from "react";

import Item from "@/components/bookmarks/item";
import type { Bookmark, GroupLayout } from "@/components/types";
import { columnMap } from "@/utils/layout/columns";

type ListProps = {
    bookmarks: Bookmark[];
    layout?: GroupLayout;
    bookmarksStyle?: string;
};

export default function List({ bookmarks, layout, bookmarksStyle }: ListProps) {
    let classes =
        layout?.style === "row" ? `grid ${columnMap[layout?.columns ?? -1]} gap-x-2` : "flex flex-col bookmark-list";
    const style: CSSProperties = {};
    if (layout?.iconsOnly || bookmarksStyle === "icons") {
        classes = "grid gap-2 bookmark-list";
        style.gridTemplateColumns = "repeat(auto-fill, minmax(60px, 1fr))";
    }
    return (
        <ul className={classNames(classes, "mb-2", layout?.header === false ? "" : "mt-3")} style={style}>
            {bookmarks.map((bookmark) => (
                <Item
                    key={`${bookmark.name}-${bookmark.href}`}
                    bookmark={bookmark}
                    iconOnly={layout?.iconsOnly || bookmarksStyle === "icons"}
                />
            ))}
        </ul>
    );
}
