import type { GreetingOptions } from "@/components/widgets/greeting/types";
import Container from "@/components/widgets/widget/container";
import Raw from "@/components/widgets/widget/raw";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";

const textSizes: Record<string, string> = {
    "4xl": "text-4xl",
    "3xl": "text-3xl",
    "2xl": "text-2xl",
    xl: "text-xl",
    lg: "text-lg",
    md: "text-md",
    sm: "text-sm",
    xs: "text-xs",
};

export default function Greeting({ options }: InfoWidgetProps<GreetingOptions>) {
    if (options.text) {
        return (
            <Container options={options} additionalClassNames="information-widget-greeting">
                <Raw>
                    <span className={`text-theme-800 dark:text-theme-200 mr-3 ${textSizes[options.text_size || "xl"]}`}>
                        {options.text}
                    </span>
                </Raw>
            </Container>
        );
    }
}
