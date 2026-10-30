// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";

vi.mock("@/components/widgets/resources/cpu", () => ({ default: () => <div data-testid="resources-cpu" /> }));
vi.mock("@/components/widgets/resources/memory", () => ({ default: () => <div data-testid="resources-memory" /> }));
vi.mock("@/components/widgets/resources/disk", () => ({
    default: ({ options }: { options: { disk?: boolean | string | string[] } }) => (
        <div data-testid="resources-disk" data-disk={String(options.disk)} />
    ),
}));
vi.mock("@/components/widgets/resources/network", () => ({ default: () => <div data-testid="resources-network" /> }));
vi.mock("@/components/widgets/resources/cputemp", () => ({ default: () => <div data-testid="resources-cputemp" /> }));
vi.mock("@/components/widgets/resources/uptime", () => ({ default: () => <div data-testid="resources-uptime" /> }));

import Resources from "@/components/widgets/resources/resources";

describe("components/widgets/resources", () => {
    it("renders selected resource blocks and an optional label", () => {
        renderWithProviders(
            <Resources
                options={{
                    cpu: true,
                    memory: true,
                    disk: ["/", "/data"],
                    network: true,
                    cputemp: true,
                    uptime: true,
                    label: "Host A",
                }}
            />,
            { settings: { target: "_self" } }
        );

        expect(screen.getByTestId("resources-cpu")).toBeInTheDocument();
        expect(screen.getByTestId("resources-memory")).toBeInTheDocument();
        expect(screen.getAllByTestId("resources-disk")).toHaveLength(2);
        expect(screen.getByTestId("resources-network")).toBeInTheDocument();
        expect(screen.getByTestId("resources-cputemp")).toBeInTheDocument();
        expect(screen.getByTestId("resources-uptime")).toBeInTheDocument();
        expect(screen.getByText("Host A")).toBeInTheDocument();
    });

    it("renders a single disk block when disk is not an array", () => {
        renderWithProviders(<Resources options={{ disk: true }} />, { settings: { target: "_self" } });

        expect(screen.getAllByTestId("resources-disk")).toHaveLength(1);
        expect(screen.getByTestId("resources-disk").getAttribute("data-disk")).toBe("true");
    });
});
