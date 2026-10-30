import type { ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "@/components/widgets/widget/container";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

type ContainerLinkProps = {
    children?: ReactNode;
    options: InfoWidgetBaseOptions;
    additionalClassNames?: string;
    target?: string;
};

export default function ContainerLink({
    children = [],
    options,
    additionalClassNames = "",
    target,
}: ContainerLinkProps) {
    return (
        <a
            href={options.href || options.url}
            target={target}
            className={`${getAllClasses(options, additionalClassNames)} information-widget-link`}
        >
            {getInnerBlock(children)}
            {getBottomBlock(children)}
        </a>
    );
}
