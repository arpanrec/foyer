import type { APIRoute } from "astro";

// The config's JSON Schema, served at the URL its `$id` names. The build copies the app's schema file as it is, so
// the site always serves the schema of the commit it was built from.
import schema from "../../../src/foyer-config/foyer.schema.json?raw";

export const GET: APIRoute = () =>
    new Response(schema, { headers: { "Content-Type": "application/schema+json; charset=utf-8" } });
