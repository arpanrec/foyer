import type { ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "@/components/widgets/widget/container";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

type ContainerButtonProps = {
    children?: ReactNode;
    options: InfoWidgetBaseOptions;
    additionalClassNames?: string;
    callback?: () => void;
};

export default function ContainerButton({
    children = [],
    options,
    additionalClassNames = "",
    callback,
}: ContainerButtonProps) {
    return (
        <button
            type="button"
            onClick={callback}
            className={`${getAllClasses(options, additionalClassNames)} information-widget-container-button`}
        >
            {getInnerBlock(children)}
            {getBottomBlock(children)}
        </button>
    );
}
