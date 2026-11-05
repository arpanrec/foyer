import type { APIRoute } from "astro";

// The config's JSON Schema, served at the URL its `$id` names. The build reads the app's schema file and writes it
// minified, so the site always serves the schema of the commit it was built from, without the source's whitespace.
import schema from "../../../src/foyer-config/foyer.schema.json?raw";

const minified = JSON.stringify(JSON.parse(schema));

export const GET: APIRoute = () =>
    new Response(minified, { headers: { "Content-Type": "application/schema+json; charset=utf-8" } });
