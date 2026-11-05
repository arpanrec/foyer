import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

export default defineConfig({
    site: "https://foyer.arpanrec.com",
    trailingSlash: "always",
    redirects: {
        "/more/troubleshooting": "/troubleshooting/",
        "/more/development": "/widgets/authoring/getting-started/",
    },
    integrations: [
        // Must come before Starlight so it sees the mermaid code fences first.
        mermaid({ autoTheme: true }),
        starlight({
            title: "Foyer",
            description:
                "A modern, fast, secure, fully proxied, highly customizable application dashboard with integrations for over 100 services.",
            logo: {
                light: "./src/assets/banner_light@2x.webp",
                dark: "./src/assets/banner_dark@2x.webp",
                replacesTitle: true,
            },
            favicon: "/favicon.ico",
            social: [{ icon: "github", label: "GitHub", href: "https://github.com/arpanrec/foyer" }],
            editLink: { baseUrl: "https://github.com/arpanrec/foyer/edit/dev/docs/" },
            customCss: ["./src/styles/custom.css"],
            // The default ThemeSelect is a native <select>; its option popup ignores page CSS on Linux Chromium
            // (an OS-drawn widget, outside the page's compositing layer), so it never matches the glass theme.
            // Footer adds the Foyer application version below Starlight's own footer content.
            components: {
                ThemeSelect: "./src/components/ThemeSelect.astro",
                Footer: "./src/components/Footer.astro",
            },
            // Shows a "Built with Starlight" credit in the footer.
            credits: true,
            // Contributor guides link to a local dev server on purpose.
            // Options: https://starlight-links-validator.vercel.app/getting-started/
            plugins: [starlightLinksValidator({ errorOnLocalLinks: false })],
            sidebar: [
                { label: "Home", link: "/" },
                {
                    label: "Installation",
                    items: [
                        "installation",
                        "installation/docker",
                        "installation/kubernetes",
                        "installation/npm",
                        "installation/source",
                    ],
                },
                {
                    label: "Configuration",
                    items: [
                        "configs",
                        "configs/environment-variables",
                        "configs/settings",
                        "configs/bookmarks",
                        "configs/info-widgets",
                        "configs/services",
                        "configs/kubernetes",
                        "configs/docker",
                        "configs/proxmox",
                        "configs/mcp",
                        "configs/custom-css-js",
                        "configs/large-config",
                    ],
                },
                {
                    label: "Widgets",
                    items: [
                        "widgets",
                        {
                            label: "Service Widgets",
                            collapsed: true,
                            items: [{ autogenerate: { directory: "widgets/services" } }],
                        },
                        {
                            label: "Information Widgets",
                            collapsed: true,
                            items: [{ autogenerate: { directory: "widgets/info" } }],
                        },
                    ],
                },
                {
                    label: "Learn",
                    items: [
                        "widgets/authoring",
                        { label: "Getting Started", slug: "widgets/authoring/getting-started" },
                        { label: "Building", slug: "widgets/authoring/build" },
                        { label: "Tutorials", items: ["widgets/authoring/tutorial"] },
                        {
                            label: "Guides",
                            items: [
                                "widgets/authoring/component",
                                "widgets/authoring/metadata",
                                "widgets/authoring/proxies",
                                "widgets/authoring/api",
                                "widgets/authoring/translations",
                            ],
                        },
                    ],
                },
                { label: "Troubleshooting", items: ["troubleshooting"] },
            ],
        }),
    ],
});
