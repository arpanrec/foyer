import { useTranslation } from "next-i18next/pages";
import { useCallback, useEffect, useState } from "react";
import { MdLocationDisabled, MdLocationSearching } from "react-icons/md";
import { WiCloudDown } from "react-icons/wi";
import useSWR from "swr";

import type { OpenMeteoData, OpenMeteoOptions } from "@/components/widgets/openmeteo/types";
import Container from "@/components/widgets/widget/container";
import ContainerButton from "@/components/widgets/widget/container_button";
import Error from "@/components/widgets/widget/error";
import PrimaryText from "@/components/widgets/widget/primary_text";
import { optionsToSearchParams } from "@/components/widgets/widget/search-params";
import SecondaryText from "@/components/widgets/widget/secondary_text";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";
import WidgetIcon from "@/components/widgets/widget/widget_icon";
import mapIcon from "@/utils/weather/openmeteo-condition-map";

function Widget({ options }: InfoWidgetProps<OpenMeteoOptions>) {
    const { t } = useTranslation();

    const { data, error } = useSWR<OpenMeteoData>(
        `/api/widgets/openmeteo?${optionsToSearchParams(options).toString()}`
    );

    if (error || data?.error) {
        return <Error options={options} />;
    }

    if (!data) {
        return (
            <Container options={options} additionalClassNames="information-widget-openmeteo">
                <PrimaryText>{t("weather.updating")}</PrimaryText>
                <SecondaryText>{t("weather.wait")}</SecondaryText>
                <WidgetIcon icon={WiCloudDown} size="l" />
            </Container>
        );
    }

    const unit = options.units === "metric" ? "celsius" : "fahrenheit";
    const condition = data.current_weather.weathercode;
    const timeOfDay =
        data.current_weather.time > data.daily.sunrise[0] && data.current_weather.time < data.daily.sunset[0]
            ? "day"
            : "night";

    return (
        <Container options={options} additionalClassNames="information-widget-openmeteo">
            <PrimaryText>
                {options.label && `${options.label}, `}
                {t("common.number", {
                    value: data.current_weather.temperature,
                    style: "unit",
                    unit,
                    ...options.format,
                })}
            </PrimaryText>
            <SecondaryText>{t(`wmo.${data.current_weather.weathercode}-${timeOfDay}`)}</SecondaryText>
            <WidgetIcon icon={mapIcon(condition, timeOfDay)} size="xl" />
        </Container>
    );
}

export default function OpenMeteo({ options }: InfoWidgetProps<OpenMeteoOptions>) {
    const { t } = useTranslation();
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | false>(false);
    const [requesting, setRequesting] = useState(false);

    if (!location && options.latitude && options.longitude) {
        setLocation({ latitude: options.latitude, longitude: options.longitude });
    }

    const requestLocation = useCallback(() => {
        setRequesting(true);
        if (typeof window !== "undefined") {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
                    setRequesting(false);
                },
                () => {
                    setRequesting(false);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000 * 60 * 60 * 3,
                    timeout: 1000 * 30,
                }
            );
        }
    }, []);

    useEffect(() => {
        if (!options.latitude && !options.longitude && typeof navigator !== "undefined") {
            navigator.permissions?.query({ name: "geolocation" }).then((result) => {
                if (result.state === "granted") {
                    requestLocation();
                }
            });
        }
    }, [options.latitude, options.longitude, requestLocation]);

    if (!location) {
        return (
            <ContainerButton
                options={options}
                callback={requestLocation}
                additionalClassNames="information-widget-openmeteo-location-button"
            >
                <PrimaryText>{t("weather.current")}</PrimaryText>
                <SecondaryText>{t("weather.allow")}</SecondaryText>
                <WidgetIcon icon={requesting ? MdLocationSearching : MdLocationDisabled} size="m" pulse />
            </ContainerButton>
        );
    }

    return <Widget options={{ ...(location || {}), ...options }} />;
}
