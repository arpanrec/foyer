import type { FormEvent, ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "@/components/widgets/widget/container";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

type ContainerFormProps = {
    children?: ReactNode;
    options: InfoWidgetBaseOptions;
    additionalClassNames?: string;
    callback?: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ContainerForm({
    children = [],
    options,
    additionalClassNames = "",
    callback,
}: ContainerFormProps) {
    return (
        <form onSubmit={callback} className={`${getAllClasses(options, additionalClassNames)} information-widget-form`}>
            {getInnerBlock(children)}
            {getBottomBlock(children)}
        </form>
    );
}
