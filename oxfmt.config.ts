import { defineConfig } from "oxfmt";

export default defineConfig({
    trailingComma: "es5",
    tabWidth: 4,
    semi: true,
    printWidth: 120,
    singleQuote: false,
    sortPackageJson: false,
    sortImports: {
        internalPattern: ["@/"],
        newlinesBetween: true,
        groups: [
            ["type-builtin", "value-builtin"],
            ["type-external", "value-external"],
            ["type-internal", "value-internal"],
            ["type-parent", "type-sibling", "type-index", "value-parent", "value-sibling", "value-index"],
            "unknown",
        ],
    },
    ignorePatterns: ["pyproject.toml"],
});
