import classNames from "classnames";
import type { ReactNode } from "react";
import { isValidElement, useContext } from "react";

import PrimaryText from "@/components/widgets/widget/primary_text";
import Raw from "@/components/widgets/widget/raw";
import SecondaryText from "@/components/widgets/widget/secondary_text";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";
import WidgetIcon from "@/components/widgets/widget/widget_icon";
import { SettingsContext } from "@/utils/contexts/settings";

export function getAllClasses(options?: InfoWidgetBaseOptions, additionalClassNames = "") {
    if (options?.style?.header === "boxedWidgets") {
        if (options?.style?.cardBlur !== undefined) {
            additionalClassNames = [
                additionalClassNames,
                `backdrop-blur${options.style.cardBlur.length ? "-" : ""}${options.style.cardBlur}`,
            ].join(" ");
        }

        return classNames(
            "flex flex-col justify-center",
            "mt-2 m:mb-0 rounded-md shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5 p-2 pl-3 pr-3",
            additionalClassNames
        );
    }

    let widgetAlignedClasses = "flex flex-col max-w:full sm:basis-auto self-center grow-0 flex-wrap";
    if (options?.style?.isRightAligned) {
        widgetAlignedClasses = "flex flex-col justify-center";
    }

    return classNames(widgetAlignedClasses, additionalClassNames);
}

function findChild(children: ReactNode[], type: unknown) {
    return children.find((child) => isValidElement(child) && child.type === type);
}

export function getInnerBlock(children: ReactNode) {
    // children won't be an array if it's Raw component
    return (
        Array.isArray(children) && (
            <div className="flex flex-row items-center justify-end widget-inner">
                <div className="flex flex-col items-center widget-inner-icon">{findChild(children, WidgetIcon)}</div>
                <div className="flex flex-col ml-3 text-left widget-inner-text">
                    {findChild(children, PrimaryText)}
                    {findChild(children, SecondaryText)}
                </div>
            </div>
        )
    );
}

export function getBottomBlock(children: ReactNode) {
    if (!isValidElement(children) || children.type !== Raw) {
        return (Array.isArray(children) && findChild(children, Raw)) || [];
    }

    return [children];
}

type ContainerProps = {
    children?: ReactNode;
    options?: InfoWidgetBaseOptions;
    additionalClassNames?: string;
};

export default function Container({ children = [], options, additionalClassNames = "" }: ContainerProps) {
    const { settings } = useContext(SettingsContext);
    return options?.href ? (
        <a
            href={options.href}
            target={options.target ?? settings.target ?? "_blank"}
            className={getAllClasses(options, `${additionalClassNames} widget-container`)}
        >
            {getInnerBlock(children)}
            {getBottomBlock(children)}
        </a>
    ) : (
        <div className={getAllClasses(options, `${additionalClassNames} widget-container`)}>
            {getInnerBlock(children)}
            {getBottomBlock(children)}
        </div>
    );
}
