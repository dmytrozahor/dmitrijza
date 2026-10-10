import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categoryKeys } from './site.config';

// Every post is a Markdown file in /content/articles or /content/blog.
// Push a new .md file to GitHub and the workflow publishes it.
const schema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  cover: z.string().optional(),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/articles' }),
  schema: schema.extend({
    category: z.enum(categoryKeys).default('programming'),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/blog' }),
  schema,
});

export const collections = { articles, blog };
