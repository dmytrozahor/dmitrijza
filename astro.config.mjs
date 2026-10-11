// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeFigures from './src/lib/rehype-figures.mjs';

// SITE and BASE are injected by the GitHub Pages workflow (actions/configure-pages).
// Locally they fall back to the custom domain: https://dmytrozah.dev
export default defineConfig({
  site: process.env.SITE ?? 'https://dmytrozah.dev',
  base: process.env.BASE ?? '',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
  markdown: {
    // $inline$ and $$block$$ LaTeX in Markdown, rendered at build time with KaTeX.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeFigures],
    shikiConfig: { themes: { light: 'github-light', dark: 'dracula' } },
  },
});
