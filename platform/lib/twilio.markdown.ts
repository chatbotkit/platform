import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

import remarkParse from 'remark-parse'
import { unified } from 'unified'

export const MAX_TWILIO_MESSAGE_LENGTH = 1600

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

export function escape(input: string): string {
  return input
}

/**
 * Extracts inline text from a node without pushing messages
 */
function extractText(definitions: Map<string, string>, node: Node): string {
  switch (node.type) {
    case 'text':
      return escape(node.value)

    case 'strong':
    case 'emphasis':
    case 'delete':
      return (
        node.children?.map(extractText.bind(null, definitions)).join('') || ''
      )

    case 'inlineCode':
      return escape(node.value)

    case 'break':
      return '\n'

    case 'link': {
      const text = node.children
        ?.map(extractText.bind(null, definitions))
        .join('')

      return text
        ? `${text} (${escape(node.url || '')})`
        : escape(node.url || '')
    }

    case 'linkReference': {
      const text = node.children
        ?.map(extractText.bind(null, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      return url && text ? `${text} (${escape(url)})` : text || ''
    }

    default:
      return (
        node.children?.map(extractText.bind(null, definitions)).join('') || ''
      )
  }
}

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

    case 'text': {
      return escape(node.value)
    }

    case 'strong': {
      return `${node.children?.map(convertNode.bind(null, messages, definitions)).join('')}`
    }

    case 'emphasis': {
      return `${node.children?.map(convertNode.bind(null, messages, definitions)).join('')}`
    }

    case 'delete': {
      return `${node.children?.map(convertNode.bind(null, messages, definitions)).join('')}`
    }

    case 'code': {
      messages.push({
        type: 'text',
        text: `${escape(node.value)}`,
      })

      return ''
    }

    case 'inlineCode': {
      return `${escape(node.value)}`
    }

    case 'break': {
      return '\n'
    }

    case 'link': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')

      if (text) {
        return `${text} (${escape(node.url || '')})`
      }

      return escape(node.url || '')
    }

    case 'linkReference': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      if (url && text) {
        return `${text} (${escape(url)})`
      }

      return text || ''
    }

    case 'definition': {
      return ''
    }

    case 'image': {
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

    case 'heading': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
        .trim()

      if (text) {
        messages.push({ type: 'text', text })
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
        messages.push({ type: 'text', text: items.join('\n') })
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
 * Converts markdown to an array of Twilio messages.
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_TWILIO_MESSAGE_LENGTH
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
