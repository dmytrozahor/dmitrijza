import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { categoryKeys } from './site.config';
import { illustrationNames } from './lib/illustrations.mjs';

// Every post is a Markdown file in /content/articles or /content/blog.
// Push a new .md file to GitHub and the workflow publishes it.
const schema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // Header image above the article, relative to the Markdown file: `cover: ./images/my-cover.jpg`
    cover: image().optional(),
    coverAlt: z.string().default(''),
    // Built-in header illustration, used when there is no cover: math | network | orbit | stream | layers
    illustration: z.enum(illustrationNames).optional(),
  });

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/articles' }),
  schema: (ctx) =>
    schema(ctx).extend({
      category: z.enum(categoryKeys).default('programming'),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/blog' }),
  schema,
});

export const collections = { articles, blog };
