import { toString } from 'mdast-util-to-string'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

/**
 * Converts Markdown to HTML
 */
export async function toHtml(input: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(input)

  return String(file)
}

/**
 * Converts Markdown to plain text by stripping all formatting.
 * Preserves the actual text content while removing markdown syntax.
 *
 * @example
 * toText('**bold** and _italic_') // returns 'bold and italic'
 * toText('[link](https://example.com)') // returns 'link'
 * toText('# Heading') // returns 'Heading'
 */
export function toText(input: string): string {
  if (!input) {
    return ''
  }

  const tree = unified().use(remarkParse).use(remarkGfm).parse(input)

  return toString(tree)
}
