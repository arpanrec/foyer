import classNames from "classnames";
import type { ReactNode } from "react";
import { useContext } from "react";

import type { Service, WidgetConfig } from "@/types/service";
import { SettingsContext } from "@/utils/contexts/settings";
import Error from "@/widgets/glances/components/error";

type ContainerProps = {
    children?: ReactNode;
    widget?: WidgetConfig;
    service?: Service;
    error?: unknown;
    chart?: boolean;
    className?: string;
};

export default function Container({ children, widget, error = null, chart = true, className = "" }: ContainerProps) {
    const { settings } = useContext(SettingsContext);
    const hideErrors = settings.hideErrors || widget?.hideErrors;

    if (error) {
        if (hideErrors) {
            return null;
        }

        return <Error />;
    }

    return (
        <div className={classNames("service-container", chart ? "chart relative h-[68px]" : "")}>
            {children}
            <div
                className={`absolute -top-10 right-0 bottom-0 left-0 overflow-clip pointer-events-none ${className}`}
            />
            {chart && <div className="h-[68px] overflow-clip" />}
            {!chart && <div className="h-[16px] overflow-clip" />}
        </div>
    );
}
