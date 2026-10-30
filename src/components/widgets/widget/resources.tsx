import classNames from "classnames";
import { isValidElement, type ReactNode } from "react";

import ContainerLink from "@/components/widgets/widget/container_link";
import Raw from "@/components/widgets/widget/raw";
import Resource from "@/components/widgets/widget/resource";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";
import WidgetLabel from "@/components/widgets/widget/widget_label";

type ResourcesProps = {
    options: InfoWidgetBaseOptions;
    children?: ReactNode;
    target?: string;
    additionalClassNames?: string;
};

export default function Resources({ options, children, target, additionalClassNames }: ResourcesProps) {
    const widgetParts = ([] as ReactNode[]).concat(...(children as ReactNode[]));
    const addedClassNames = classNames("information-widget-resources", additionalClassNames);

    return (
        <ContainerLink options={options} target={target} additionalClassNames={addedClassNames}>
            <Raw>
                <div className="flex flex-row self-center flex-wrap justify-between">
                    {widgetParts.filter((child) => isValidElement(child) && child.type === Resource)}
                </div>
                {widgetParts.filter((child) => isValidElement(child) && child.type === WidgetLabel)}
            </Raw>
        </ContainerLink>
    );
}
