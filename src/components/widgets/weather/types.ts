import type { InfoWidgetBaseOptions } from "@/components/widgets/widget/types";

// Options shared by the weather widgets; the coordinates come from the config or from the browser's geolocation
export type WeatherBaseOptions = InfoWidgetBaseOptions & {
    latitude?: number;
    longitude?: number;
    units?: string;
    format?: Intl.NumberFormatOptions;
};

export type WeatherOptions = WeatherBaseOptions;

export type WeatherData = {
    error?: unknown;
    current: {
        condition: { code: number; text: string };
        is_day: number;
        temp_c: number;
        temp_f: number;
    };
};
