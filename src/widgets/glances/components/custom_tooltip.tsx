type TooltipPayloadItem = {
    dataKey?: string | number;
    name?: string | number;
    value?: number;
};

type TooltipProps = {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    formatter: (value: unknown) => string;
};

export default function Tooltip({ active, payload, formatter }: TooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-theme-800/80 rounded-md text-theme-200 px-2 py-0">
                {payload.map((pld, id) => (
                    <div key={`${pld.dataKey ?? pld.name ?? "series"}-${id}`} className="first-of-type:pt-0 pt-0.5">
                        <div>
                            {formatter(pld.value ?? 0)} {payload[id].name}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
}
