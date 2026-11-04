import type { ReactNode } from "react";

type BlockProps = {
    position: string;
    children: ReactNode;
};

export default function Block({ position, children }: BlockProps) {
    return <div className={`absolute ${position} z-20 text-sm pointer-events-none`}>{children}</div>;
}
