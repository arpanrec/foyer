import type { WeatherBaseOptions } from "@/components/widgets/weather/types";

export type OpenWeatherMapOptions = WeatherBaseOptions;

export type OpenWeatherMapData = {
    error?: unknown;
    cod?: number;
    dt: number;
    sys: { sunrise: number; sunset: number };
    weather: { id: number; description: string }[];
    main: { temp: number };
};
