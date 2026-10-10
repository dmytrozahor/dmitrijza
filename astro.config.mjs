// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// SITE and BASE are injected by the GitHub Pages workflow (actions/configure-pages).
// Locally they fall back to the project-page URL: https://dmytrozahor.github.io/dmitrijza
export default defineConfig({
  site: process.env.SITE ?? 'https://dmytrozahor.github.io',
  base: process.env.BASE ?? '/dmitrijza',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
  markdown: {
    // $inline$ and $$block$$ LaTeX in Markdown, rendered at build time with KaTeX.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { themes: { light: 'github-light', dark: 'dracula' } },
  },
});
