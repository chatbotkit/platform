import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

import remarkParse from 'remark-parse'
import { unified } from 'unified'

// @note Google Chat has a 4096-character limit per message
export const MAX_GOOGLECHAT_MESSAGE_LENGTH = 4096

interface TextMessage {
  type: 'text'
  text: string
}

interface ImageMessage {
  type: 'image'
  image: string
}

type Message = TextMessage | ImageMessage

interface Node {
  type: string
  value: string
  lang?: string
  url?: string
  alt?: string
  title?: string
  identifier?: string
  ordered?: boolean
  children?: Node[]
}

/**
 * Extracts inline text from a node without pushing to messages.
 *
 * @note Used by blockquotes and list items where we need to flatten the
 * content into a single string rather than pushing separate messages.
 */
function extractInlineText(
  definitions: Map<string, string>,
  node: Node
): string {
  switch (node.type) {
    case 'paragraph':
    case 'listItem': {
      return (
        node.children
          ?.map(extractInlineText.bind(null, definitions))
          .join('') || ''
      )
    }
    case 'text': {
      return node.value
    }
    case 'strong': {
      return `*${node.children?.map(extractInlineText.bind(null, definitions)).join('')}*`
    }
    case 'emphasis': {
      return `_${node.children?.map(extractInlineText.bind(null, definitions)).join('')}_`
    }
    case 'delete': {
      return `~${node.children?.map(extractInlineText.bind(null, definitions)).join('')}~`
    }
    case 'inlineCode': {
      return `\`${node.value}\``
    }
    case 'code': {
      return `\`\`\`\n${node.value}\n\`\`\``
    }
    case 'break': {
      return '\n'
    }
    case 'link': {
      const text = node.children
        ?.map(extractInlineText.bind(null, definitions))
        .join('')

      if (text) {
        return `${text} (${node.url || ''})`
      }

      return node.url || ''
    }
    case 'linkReference': {
      const text = node.children
        ?.map(extractInlineText.bind(null, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      if (url && text) {
        return `${text} (${url})`
      }

      return text || ''
    }
    case 'definition': {
      return ''
    }
    default: {
      return (
        node.children
          ?.map(extractInlineText.bind(null, definitions))
          .join('') || ''
      )
    }
  }
}

/**
 * Converts a markdown AST node to Google Chat messages.
 *
 * @note Google Chat supports *bold*, _italic_, ~strikethrough~, `code`,
 * ```code blocks```, and auto-linkified URLs. It does not support markdown
 * link syntax, headings, blockquotes, or list formatting natively.
 */
function convertNode(
  messages: Message[],
  definitions: Map<string, string>,
  node: Node
): string {
  switch (node.type) {
    case 'paragraph': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')

      if (text) {
        messages.push({ type: 'text', text })
      }

      return ''
    }

    case 'heading': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
        .trim()

      if (text) {
        messages.push({ type: 'text', text: `*${text}*` })
      }

      return ''
    }

    case 'text': {
      return node.value
    }

    case 'strong': {
      return `*${node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')}*`
    }

    case 'emphasis': {
      return `_${node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')}_`
    }

    case 'delete': {
      return `~${node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')}~`
    }

    case 'code': {
      messages.push({
        type: 'text',
        text: `\`\`\`\n${node.value}\n\`\`\``,
      })

      return ''
    }

    case 'inlineCode': {
      return `\`${node.value}\``
    }

    case 'break': {
      return '\n'
    }

    case 'link': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')

      // @note Google Chat auto-linkifies URLs so we show "text (url)"
      if (text) {
        return `${text} (${node.url || ''})`
      }

      return node.url || ''
    }

    case 'linkReference': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      if (url && text) {
        return `${text} (${url})`
      }

      return text || ''
    }

    case 'definition': {
      return ''
    }

    case 'image': {
      // @note Google Chat text messages cannot embed images inline so we
      // send them as separate image messages
      if (node.url && /^https?:\/\//.test(node.url)) {
        messages.push({ type: 'image', image: node.url })
      }

      return ''
    }

    case 'imageReference': {
      const url = definitions.get(node.identifier ?? '')

      if (url && /^https?:\/\//.test(url)) {
        messages.push({ type: 'image', image: url })
      }

      return ''
    }

    case 'list': {
      const listImages: ImageMessage[] = []

      const items = node.children
        ?.map((item, index) => {
          // @note collect images from list items separately since they
          // cannot be rendered inline in Google Chat text messages
          const images = item.children?.filter(
            (c) =>
              c.type === 'paragraph' &&
              c.children?.some(
                (gc) =>
                  gc.type === 'image' && gc.url && /^https?:\/\//.test(gc.url)
              )
          )

          images?.forEach((p) =>
            p.children
              ?.filter(
                (gc) =>
                  gc.type === 'image' && gc.url && /^https?:\/\//.test(gc.url)
              )
              .forEach((img) =>
                listImages.push({ type: 'image', image: img.url! })
              )
          )

          const text = extractInlineText(definitions, item).trim()

          if (!text) {
            return ''
          }

          return node.ordered ? `${index + 1}. ${text}` : `- ${text}`
        })
        .filter(Boolean)
        .join('\n')

      if (items) {
        messages.push({ type: 'text', text: items })
      }

      if (listImages.length) {
        messages.push(...listImages)
      }

      return ''
    }

    case 'listItem': {
      return (
        node.children
          ?.map(convertNode.bind(null, messages, definitions))
          .join('') || ''
      )
    }

    case 'blockquote': {
      const text = (
        node.children
          ?.map(extractInlineText.bind(null, definitions))
          .join('\n') || ''
      ).trim()

      // @note Google Chat does not support blockquote syntax so we
      // prefix each line with ">" for a reasonable visual approximation
      if (text) {
        const quoted = text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')

        messages.push({ type: 'text', text: quoted })
      }

      return ''
    }

    case 'thematicBreak': {
      messages.push({ type: 'text', text: '---' })

      return ''
    }

    default: {
      return node.children
        ? node.children
            .map(convertNode.bind(null, messages, definitions))
            .join('')
        : ''
    }
  }
}

function splitMessagesBySize(
  messages: Message[],
  maxLength: number
): Message[] {
  return messages.flatMap((message) => {
    if (message.type !== 'text' || message.text.length <= maxLength) {
      return [message]
    }

    return splitTextByTopLevelBlocksToSize(message.text, maxLength)
      .filter(Boolean)
      .map((text) => ({
        type: 'text' as const,
        text,
      }))
  })
}

/**
 * Collects link reference definitions from the AST tree.
 */
function collectDefinitions(tree: Node): Map<string, string> {
  const definitions = new Map<string, string>()

  function walk(node: Node) {
    if (node.type === 'definition' && node.identifier && node.url) {
      definitions.set(node.identifier, node.url)
    }

    node.children?.forEach(walk)
  }

  walk(tree)

  return definitions
}

/**
 * Converts markdown to an array of Google Chat messages.
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_GOOGLECHAT_MESSAGE_LENGTH
): Promise<Message[]> {
  const processor = unified().use(remarkParse)

  const tree = processor.parse(markdown) as Node

  const definitions = collectDefinitions(tree)

  const messages: Message[] = []

  tree.children?.map(convertNode.bind(null, messages, definitions))

  return splitMessagesBySize(messages, maxLength)
}
