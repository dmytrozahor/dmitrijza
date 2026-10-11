import { visit } from 'unist-util-visit';
import { renderIllustration } from './illustrations.mjs';

/**
 * Markdown helpers for articles:
 *  - `![alt](src "Caption")` on its own line becomes <figure><img><figcaption>Caption</figcaption></figure>.
 *  - `<figure data-illustration="stream">…</figure>` gets the named built-in illustration inserted.
 *
 * Custom rehype plugins run before Astro parses raw HTML, so illustrations are inserted into the raw HTML text.
 */
export default function rehypeFigures() {
  return (tree) => {
    visit(tree, 'raw', (node) => {
      node.value = node.value.replace(
        /<figure([^>]*?)\sdata-illustration="([a-z-]+)"([^>]*)>/g,
        (_, before, name, after) =>
          `<figure class="ill-figure"${before} data-illustration="${name}"${after}><div class="ill">${renderIllustration(name, 'fig')}</div>`,
      );
    });

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'p' || !parent || index === undefined) return;
      const children = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const img = children[0];
      if (children.length !== 1 || img.type !== 'element' || img.tagName !== 'img' || !img.properties?.title) return;

      const caption = String(img.properties.title);
      delete img.properties.title;
      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {},
        children: [img, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] }],
      };
    });
  };
}
