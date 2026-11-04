import { useCallback, useState } from "react";

export default function useDataPoints<T>(pointsLimit: number, initialPoint: T) {
    const [dataPoints, setDataPoints] = useState<T[]>(() => new Array<T>(pointsLimit).fill(initialPoint));

    const addDataPoint = useCallback(
        (dataPoint: T) => {
            setDataPoints((currentDataPoints) => {
                if (pointsLimit <= 0) return [];
                return [...currentDataPoints, dataPoint].slice(-pointsLimit);
            });
        },
        [pointsLimit]
    );

    return [dataPoints, addDataPoint] as const;
}
