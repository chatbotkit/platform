import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'

interface LinkNode extends Node {
  type: 'link'
  url: string
}

function isLinkNode(node: Node): node is LinkNode {
  return node.type === 'link' && 'url' in node && typeof node.url === 'string'
}

/**
 * Extract URLs from text using remark with GFM support
 * Automatically excludes URLs in code blocks and images
 * GFM autolink literals convert plain text URLs to link nodes automatically
 */
export function extractUrls(text: string): string[] {
  if (!text) {
    return []
  }

  const urls: string[] = []

  // parse markdown using remark with GFM (autolink literals)

  const tree = unified().use(remarkParse).use(remarkGfm).parse(text)

  // visit all nodes and extract URLs from link nodes

  visit(tree, (node: Node) => {
    // @note GFM automatically converts plain text URLs to link nodes

    if (isLinkNode(node)) {
      urls.push(node.url)
    }
  })

  return urls
}
