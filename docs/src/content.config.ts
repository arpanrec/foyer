import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";

export const collections = {
    docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
    // Starlight always reads this collection for UI string overrides, and Astro warns about an empty collection, so
    // src/content/i18n/en.json exists with no overrides. Add a key there to change one of Starlight's English labels.
    i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
