import Image from "next/image";
import { useContext } from "react";

import { SettingsContext } from "@/utils/contexts/settings";
import { ThemeContext } from "@/utils/contexts/theme";
import { absoluteImageUrl, proxiedImageUrl } from "@/utils/image-url";

// Every icon is served by the Foyer server (/api/icons), so the browser never contacts a CDN
const iconSets = new Set(["mdi", "si"]);

type ResolvedIconProps = {
    icon: string;
    width?: number;
    height?: number;
    alt?: string | undefined;
};

export default function ResolvedIcon({ icon, width = 32, height = 32, alt = "logo" }: ResolvedIconProps) {
    const { settings } = useContext(SettingsContext);
    const { theme } = useContext(ThemeContext);

    // relative URLs are served by this origin, full URLs go through the server so the browser never contacts them
    if (absoluteImageUrl(icon) || icon.startsWith("/")) {
        return (
            <Image
                src={proxiedImageUrl(icon)}
                width={width}
                height={height}
                style={{
                    width,
                    height,
                    objectFit: "contain",
                    maxHeight: "100%",
                    maxWidth: "100%",
                }}
                alt={alt}
            />
        );
    }

    // check mdi- or si- prefixed icons
    const prefix = icon.split("-")[0] ?? "";

    if (prefix === "sh") {
        const iconName = icon.replace("sh-", "").replace(".svg", "").replace(".png", "").replace(".webp", "");

        let extension;
        if (icon.endsWith(".svg")) {
            extension = "svg";
        } else if (icon.endsWith(".webp")) {
            extension = "webp";
        } else {
            extension = "png";
        }

        return (
            <Image
                src={`/api/icons/sh/${extension}/${iconName}.${extension}`}
                width={width}
                height={height}
                style={{
                    width,
                    height,
                    objectFit: "contain",
                    maxHeight: "100%",
                    maxWidth: "100%",
                }}
                alt={alt}
            />
        );
    }

    if (iconSets.has(prefix)) {
        // default to theme setting
        let iconName = icon.replace(`${prefix}-`, "").replace(".svg", "");
        let iconColor =
            settings.iconStyle === "theme"
                ? `rgb(var(--color-${theme === "dark" ? 300 : 900}) / var(--tw-text-opacity, 1))`
                : "linear-gradient(180deg, rgb(var(--color-logo-start)), rgb(var(--color-logo-stop)))";

        // use custom hex color if provided
        const colorMatches = icon.match(/[#][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]$/i);
        if (colorMatches?.length) {
            iconName = icon.replace(`${prefix}-`, "").replace(".svg", "").replace(`-${colorMatches[0]}`, "");
            iconColor = `${colorMatches[0]}`;
        }

        const iconSource = `/api/icons/${prefix}/${iconName}.svg`;

        return (
            <div
                style={{
                    width,
                    height,
                    maxWidth: "100%",
                    maxHeight: "100%",
                    background: `${iconColor}`,
                    mask: `url(${iconSource}) no-repeat center / contain`,
                    WebkitMask: `url(${iconSource}) no-repeat center / contain`,
                }}
            />
        );
    }

    // fallback to dashboard-icons
    if (icon.endsWith(".svg")) {
        const iconName = icon.replace(".svg", "");
        return (
            <Image
                src={`/api/icons/di/svg/${iconName}.svg`}
                width={width}
                height={height}
                style={{
                    width,
                    height,
                    objectFit: "contain",
                    maxHeight: "100%",
                    maxWidth: "100%",
                }}
                alt={alt}
            />
        );
    }

    if (icon.endsWith(".webp")) {
        const iconName = icon.replace(".webp", "");
        return (
            <Image
                src={`/api/icons/di/webp/${iconName}.webp`}
                width={width}
                height={height}
                style={{
                    width,
                    height,
                    objectFit: "contain",
                    maxHeight: "100%",
                    maxWidth: "100%",
                }}
                alt={alt}
            />
        );
    }

    const iconName = icon.replace(".png", "");
    return (
        <Image
            src={`/api/icons/di/png/${iconName}.png`}
            width={width}
            height={height}
            style={{
                width,
                height,
                objectFit: "contain",
                maxHeight: "100%",
                maxWidth: "100%",
            }}
            alt={alt}
        />
    );
}
