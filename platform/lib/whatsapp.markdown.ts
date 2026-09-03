import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

import remarkParse from 'remark-parse'
import { unified } from 'unified'

export const MAX_WHATSAPP_MESSAGE_LENGTH = 4096

interface TextMessage {
  type: 'text'
  text: {
    body: string
    preview_url: boolean
  }
}

interface ImageMessage {
  type: 'image'
  image: {
    link: string
    caption: string
  }
}

interface VideoMessage {
  type: 'video'
  video: {
    link: string
    caption?: string
  }
}

interface AudioMessage {
  type: 'audio'
  audio: {
    link: string
  }
}

interface DocumentMessage {
  type: 'document'
  document: {
    link: string
    caption?: string
    filename?: string
  }
}

type Message =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | AudioMessage
  | DocumentMessage

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

function isVideoURL(url: string): boolean {
  return (
    /^https?:\/\//.test(url) &&
    /\.(mp4|mov|webm|m4v|avi|mkv|ogg)(\?.*)?$/i.test(url)
  )
}

function isAudioURL(url: string): boolean {
  return (
    /^https?:\/\//.test(url) &&
    /\.(mp3|m4a|aac|wav|flac|opus|oga|ogg)(\?.*)?$/i.test(url)
  )
}

function isDocumentURL(url: string): boolean {
  return (
    /^https?:\/\//.test(url) &&
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|rtf|odt|ods|odp|zip|rar|7z)(\?.*)?$/i.test(
      url
    )
  )
}

function getMediaCaption(alt?: string, title?: string): string {
  return alt || title || 'image'
}

function toMediaMessage(url: string, alt?: string, title?: string): Message {
  if (isVideoURL(url)) {
    const caption = alt || title

    return {
      type: 'video',
      video: {
        link: url,
        ...(caption ? { caption } : {}),
      },
    }
  }

  if (isAudioURL(url)) {
    return {
      type: 'audio',
      audio: {
        link: url,
      },
    }
  }

  if (isDocumentURL(url)) {
    const caption = alt || title || 'document'

    return {
      type: 'document',
      document: {
        link: url,
        ...(caption ? { caption } : {}),
        filename: caption,
      },
    }
  }

  return {
    type: 'image',
    image: {
      link: url,
      caption: getMediaCaption(alt, title),
    },
  }
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
 * Converts a markdown AST node to WhatsApp message format
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
        messages.push({ type: 'text', text: { body: text, preview_url: true } })
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
          text: { body: `*${text}*`, preview_url: true },
        })
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
          preview_url: false,
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
        messages.push(toMediaMessage(node.url, node.alt, node.title))
      }

      return ''
    }

    case 'imageReference': {
      const url = definitions.get(node.identifier ?? '')

      if (url && /^https?:\/\//.test(url)) {
        messages.push(toMediaMessage(url, node.alt, node.title))
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
          text: { body: items.join('\n'), preview_url: true },
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
          text: { body: quoted, preview_url: true },
        })
      }

      return ''
    }

    case 'thematicBreak': {
      messages.push({
        type: 'text',
        text: { body: '---', preview_url: false },
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
        text: {
          body,
          preview_url: message.text.preview_url,
        },
      }))
  })
}

/**
 * Converts markdown to an array of WhatsApp messages
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_WHATSAPP_MESSAGE_LENGTH
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

/**
 * Combine consecutive text messages while keeping image messages separate
 */
export function mergeMessagesByType(
  messages: Message[],
  maxLength: number = MAX_WHATSAPP_MESSAGE_LENGTH
): Message[] {
  const result: Message[] = []

  for (const message of messages) {
    if (message.type === 'text') {
      const last = result[result.length - 1]

      const candidateBody =
        last && last.type === 'text'
          ? `${last.text.body}\n\n${message.text.body}`
          : null

      if (
        last &&
        last.type === 'text' &&
        candidateBody &&
        candidateBody.length <= maxLength
      ) {
        last.text.body = candidateBody

        last.text.preview_url =
          last.text.preview_url || message.text.preview_url
      } else {
        result.push({ ...message })
      }
    } else {
      result.push(message)
    }
  }

  return result
}
