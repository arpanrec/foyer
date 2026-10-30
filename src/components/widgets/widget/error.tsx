import { useTranslation } from "next-i18next/pages";
import { BiError } from "react-icons/bi";

import Container from "@/components/widgets/widget/container";
import PrimaryText from "@/components/widgets/widget/primary_text";
import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";
import WidgetIcon from "@/components/widgets/widget/widget_icon";

type ErrorProps = {
    options?: InfoWidgetBaseOptions;
};

export default function Error({ options }: ErrorProps) {
    const { t } = useTranslation();

    return (
        <Container options={options} additionalClassNames="information-widget-error">
            <PrimaryText>{t("widget.api_error")}</PrimaryText>
            <WidgetIcon icon={BiError} size="l" />
        </Container>
    );
}
