import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../site.config';
import { getAllPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  return rss({
    title: site.name,
    description: site.description,
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postUrl(post),
      categories: [post.collection, ...post.data.tags],
    })),
  });
}
