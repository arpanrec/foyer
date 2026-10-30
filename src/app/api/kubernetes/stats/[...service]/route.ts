import handler from "@/app/api/kubernetes/stats/[...service]/handler";
import { toRouteHandlers } from "@/utils/api-route";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS } = toRouteHandlers(handler);
