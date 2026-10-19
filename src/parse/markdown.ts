import type { Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export function parseMarkdown(content: string): Root {
  return unified().use(remarkParse).parse(content) as Root;
}
