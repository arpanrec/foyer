import Dashboard from "@/app/dashboard";
import { requirePageAuth } from "@/utils/app-auth";
import { getDashboardData } from "@/utils/config/dashboard";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await requirePageAuth("/", await searchParams);
    const { initialSettings, fallback } = await getDashboardData();
    return <Dashboard initialSettings={initialSettings} fallback={fallback} />;
}
