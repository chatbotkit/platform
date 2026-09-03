import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

import remarkParse from 'remark-parse'
import { unified } from 'unified'

export const MAX_INSTAGRAM_MESSAGE_LENGTH = 1000

export interface TextMessage {
  type: 'text'
  text: {
    body: string
  }
}

export interface ImageMessage {
  type: 'image'
  image: {
    link: string
    caption: string
  }
}

export type Message = TextMessage | ImageMessage

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
 * Extracts inline text from a node without pushing messages
 */
function extractText(definitions: Map<string, string>, node: Node): string {
  switch (node.type) {
    case 'text':
      return node.value

    case 'strong':
      return `*${node.children?.map(extractText.bind(null, definitions)).join('') || ''}*`

    case 'emphasis':
      return `_${node.children?.map(extractText.bind(null, definitions)).join('') || ''}_`

    case 'delete':
      return `~${node.children?.map(extractText.bind(null, definitions)).join('') || ''}~`

    case 'inlineCode':
      return `\`${node.value}\``

    case 'break':
      return '\n'

    case 'link': {
      const text = node.children
        ?.map(extractText.bind(null, definitions))
        .join('')

      return text ? `${text} (${node.url || ''})` : node.url || ''
    }

    case 'linkReference': {
      const text = node.children
        ?.map(extractText.bind(null, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      return url && text ? `${text} (${url})` : text || ''
    }

    default:
      return (
        node.children?.map(extractText.bind(null, definitions)).join('') || ''
      )
  }
}

/**
 * Converts a single markdown AST node to Instagram message format
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
        messages.push({ type: 'text', text: { body: text } })
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
        text: {
          body: `\`\`\`\n${node.value}\n\`\`\``,
        },
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

      if (text) {
        return `${text} (${node.url || ''})`
      } else {
        return node.url || ''
      }
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
      if (node.url && /^https?:\/\//.test(node.url)) {
        messages.push({
          type: 'image',
          image: { link: node.url, caption: node.alt || node.title || 'image' },
        })
      }

      return ''
    }

    case 'imageReference': {
      const url = definitions.get(node.identifier ?? '')

      if (url && /^https?:\/\//.test(url)) {
        messages.push({
          type: 'image',
          image: { link: url, caption: node.alt || 'image' },
        })
      }

      return ''
    }

    case 'heading': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
        .trim()

      if (text) {
        messages.push({
          type: 'text',
          text: { body: `*${text}*` },
        })
      }

      return ''
    }

    case 'list': {
      const items: string[] = []

      node.children?.forEach((listItem, index) => {
        const text = listItem.children
          ?.map(extractText.bind(null, definitions))
          .join('')
          .trim()

        if (text) {
          const prefix = node.ordered ? `${index + 1}. ` : '- '

          items.push(`${prefix}${text}`)
        }
      })

      if (items.length > 0) {
        messages.push({
          type: 'text',
          text: { body: items.join('\n') },
        })
      }

      return ''
    }

    case 'blockquote': {
      const parts: string[] = []

      node.children?.forEach((child) => {
        const text = child.children
          ?.map(extractText.bind(null, definitions))
          .join('')
          .trim()

        if (text) {
          parts.push(text)
        }
      })

      if (parts.length > 0) {
        const quoted = parts
          .join('\n')
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')

        messages.push({
          type: 'text',
          text: { body: quoted },
        })
      }

      return ''
    }

    case 'thematicBreak': {
      messages.push({
        type: 'text',
        text: { body: '---' },
      })

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
    if (message.type !== 'text' || message.text.body.length <= maxLength) {
      return [message]
    }

    return splitTextByTopLevelBlocksToSize(message.text.body, maxLength)
      .filter(Boolean)
      .map((body) => ({
        type: 'text' as const,
        text: { body },
      }))
  })
}

/**
 * Converts markdown to an array of Instagram messages
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_INSTAGRAM_MESSAGE_LENGTH
): Promise<Message[]> {
  const processor = unified().use(remarkParse)

  const tree = processor.parse(markdown) as Node

  // @note collect definition nodes (from reference-style links) so we can
  // resolve linkReference nodes during conversion
  const definitions = new Map<string, string>()

  function collectDefinitions(node: Node) {
    if (node.type === 'definition' && node.identifier && node.url) {
      definitions.set(node.identifier, node.url)
    }

    node.children?.forEach(collectDefinitions)
  }

  collectDefinitions(tree)

  const messages: Message[] = []

  tree.children?.map(convertNode.bind(null, messages, definitions))

  return splitMessagesBySize(messages, maxLength)
}
