import { getCollection, type CollectionEntry } from 'astro:content';
import { categories, site, type Category } from '../site.config';

export type Kind = 'articles' | 'blog';
export type Post = CollectionEntry<Kind>;

export const kindLabel: Record<Kind, string> = { articles: 'Article', blog: 'Blog' };

export async function getPosts(kind: Kind): Promise<Post[]> {
  const posts = await getCollection(kind, ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getAllPosts(): Promise<Post[]> {
  const [articles, blog] = await Promise.all([getPosts('articles'), getPosts('blog')]);
  return [...articles, ...blog].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Prefix a site-relative path with the configured base, leaving absolute URLs alone. */
export function url(path = ''): string {
  if (/^(https?:|mailto:)/.test(path)) return path;
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export const postUrl = (post: Post) => url(`${post.collection}/${post.id}/`);

export const categoryUrl = (key: Category) => url(`/articles/category/${key}/`);

/** The category of an article (blog posts have none). */
export function categoryOf(post: Post) {
  if (post.collection !== 'articles') return undefined;
  const key = post.data.category;
  return { key, ...categories[key] };
}

export function readingTime(body = ''): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const slugifyTag = (tag: string) =>
  tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const repoBase = `https://github.com/${site.repo.owner}/${site.repo.name}`;

export const editUrl = (post: Post) => `${repoBase}/edit/${site.repo.branch}/${post.filePath}`;

export function discussUrl(post: Post): string {
  return `${repoBase}/issues/new?title=${encodeURIComponent(`Discussion: ${post.data.title}`)}`;
}
