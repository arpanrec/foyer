import { useTranslation } from "next-i18next/pages";

export default function Version() {
    const { i18n } = useTranslation();

    // An empty or whitespace-only build time falls back to the current time
    const configuredBuildTime = process.env.NEXT_PUBLIC_BUILDTIME?.trim() ?? "";
    const buildTime = configuredBuildTime.length
        ? configuredBuildTime
        : // oxlint-disable-next-line react/purity -- the current time is read on every render
          new Date().toISOString();
    const revision = process.env.NEXT_PUBLIC_REVISION?.length ? process.env.NEXT_PUBLIC_REVISION : "dev";
    const version = process.env.NEXT_PUBLIC_VERSION?.length ? process.env.NEXT_PUBLIC_VERSION : "dev";

    // Format the build time as a date; a value that does not parse as one is shown as written
    const formatDate = (date: string) => {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) {
            return date;
        }
        const options: Intl.DateTimeFormatOptions = {
            year: "numeric",
            month: "short",
            day: "numeric",
        };
        return new Intl.DateTimeFormat(i18n.language, options).format(parsed);
    };

    return (
        <div id="version" className="flex flex-row items-center">
            <span className="text-xs text-theme-500 dark:text-theme-400">
                {version === "main" || version === "dev" || version === "nightly" ? (
                    <>
                        {version} ({revision.substring(0, 7)}, {formatDate(buildTime)})
                    </>
                ) : (
                    <a
                        href={`https://github.com/arpanrec/foyer/releases/tag/${version}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-theme-500 dark:text-theme-400 flex flex-row items-center"
                    >
                        {version} ({revision.substring(0, 7)}, {formatDate(buildTime)})
                    </a>
                )}
            </span>
        </div>
    );
}
