export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { default: startNode } = await import("@/instrumentation-node");
        await startNode();
    }
}
