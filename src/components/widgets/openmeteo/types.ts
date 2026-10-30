import type { WeatherBaseOptions } from "@/components/widgets/weather/types";

export type OpenMeteoOptions = WeatherBaseOptions;

export type OpenMeteoData = {
    error?: unknown;
    current_weather: { weathercode: number; time: string; temperature: number };
    daily: { sunrise: string[]; sunset: string[] };
};
