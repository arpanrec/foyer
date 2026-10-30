import { useTranslation } from "next-i18next/pages";
import { useCallback, useEffect, useState } from "react";
import { MdLocationDisabled, MdLocationSearching } from "react-icons/md";
import { WiCloudDown } from "react-icons/wi";
import useSWR from "swr";

import type { WeatherData, WeatherOptions } from "@/components/widgets/weather/types";
import Container from "@/components/widgets/widget/container";
import ContainerButton from "@/components/widgets/widget/container_button";
import Error from "@/components/widgets/widget/error";
import PrimaryText from "@/components/widgets/widget/primary_text";
import { optionsToSearchParams } from "@/components/widgets/widget/search-params";
import SecondaryText from "@/components/widgets/widget/secondary_text";
import type { InfoWidgetProps } from "@/components/widgets/widget/types";
import WidgetIcon from "@/components/widgets/widget/widget_icon";
import mapIcon from "@/utils/weather/condition-map";

function Widget({ options }: InfoWidgetProps<WeatherOptions>) {
    const { t, i18n } = useTranslation();

    const { data, error } = useSWR<WeatherData>(
        `/api/widgets/weather?${optionsToSearchParams(options, { lang: i18n.language }).toString()}`
    );

    if (error || data?.error) {
        return <Error options={options} />;
    }

    if (!data) {
        return (
            <Container options={options} additionalClassNames="information-widget-weather">
                <PrimaryText>{t("weather.updating")}</PrimaryText>
                <SecondaryText>{t("weather.wait")}</SecondaryText>
                <WidgetIcon icon={WiCloudDown} size="l" />
            </Container>
        );
    }

    const unit = options.units === "metric" ? "celsius" : "fahrenheit";
    const condition = data.current.condition.code;
    const timeOfDay = data.current.is_day ? "day" : "night";

    return (
        <Container options={options} additionalClassNames="information-widget-weather">
            <PrimaryText>
                {options.label && `${options.label}, `}
                {t("common.number", {
                    value: options.units === "metric" ? data.current.temp_c : data.current.temp_f,
                    style: "unit",
                    unit,
                    ...options.format,
                })}
            </PrimaryText>
            <SecondaryText>{data.current.condition.text}</SecondaryText>
            <WidgetIcon icon={mapIcon(condition, timeOfDay)} size="xl" />
        </Container>
    );
}

export default function WeatherApi({ options }: InfoWidgetProps<WeatherOptions>) {
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
            <ContainerButton options={options} callback={requestLocation}>
                <PrimaryText>{t("weather.current")}</PrimaryText>
                <SecondaryText>{t("weather.allow")}</SecondaryText>
                <WidgetIcon icon={requesting ? MdLocationSearching : MdLocationDisabled} size="m" pulse />
            </ContainerButton>
        );
    }

    return <Widget options={{ ...(location || {}), ...options }} />;
}
