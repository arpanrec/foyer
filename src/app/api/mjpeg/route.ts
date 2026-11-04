import handler from "@/app/api/mjpeg/handler";

export const dynamic = "force-dynamic";

// A stream cannot go through toRouteHandlers, which collects the whole body before it answers
export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
