import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'
import { tryParse as tryParseYaml } from '@/lib/yaml'

import remarkParse from 'remark-parse'
import { unified } from 'unified'

export const MAX_MESSENGER_MESSAGE_LENGTH = 2000

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

export interface VideoMessage {
  type: 'video'
  video: {
    link: string
  }
}

export interface AudioMessage {
  type: 'audio'
  audio: {
    link: string
  }
}

export interface FileMessage {
  type: 'file'
  file: {
    link: string
  }
}

export interface QuickReplyMessage {
  type: 'quickReplies'
  text: {
    body: string
  }
  quickReplies: Array<{
    content_type: 'text'
    title: string
    payload: string
  }>
}

export type Message =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | AudioMessage
  | FileMessage
  | QuickReplyMessage

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

function parseButtonsQuickReplies(markdownButtons: string): Array<{
  content_type: 'text'
  title: string
  payload: string
}> {
  const parsed = tryParseYaml(markdownButtons)

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .filter(
      (item): item is { caption?: unknown; href?: unknown } =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    )
    .filter(
      (item): item is { caption: string; href?: unknown } =>
        typeof item.caption === 'string'
    )
    .filter((item) => item.caption.trim().length > 0)
    .filter((item) => !item.href)
    .map((item) => {
      const title = item.caption.trim().slice(0, 20)

      return {
        content_type: 'text' as const,
        title,
        payload: title,
      }
    })
    .slice(0, 13)
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
 * Converts a single markdown AST node to messenger message format
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
      if (node.lang?.toLowerCase() === 'buttons') {
        const quickReplies = parseButtonsQuickReplies(node.value || '')

        if (quickReplies.length > 0) {
          messages.push({
            type: 'quickReplies',
            text: {
              body: 'Choose an option:',
            },
            quickReplies,
          })

          return ''
        }
      }

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
        if (isVideoURL(node.url)) {
          messages.push({
            type: 'video',
            video: { link: node.url },
          })
        } else if (isAudioURL(node.url)) {
          messages.push({
            type: 'audio',
            audio: { link: node.url },
          })
        } else if (isDocumentURL(node.url)) {
          messages.push({
            type: 'file',
            file: { link: node.url },
          })
        } else {
          messages.push({
            type: 'image',
            image: {
              link: node.url,
              caption: node.alt || node.title || 'image',
            },
          })
        }
      }

      return ''
    }

    case 'imageReference': {
      const url = definitions.get(node.identifier ?? '')

      if (url && /^https?:\/\//.test(url)) {
        if (isVideoURL(url)) {
          messages.push({
            type: 'video',
            video: { link: url },
          })
        } else if (isAudioURL(url)) {
          messages.push({
            type: 'audio',
            audio: { link: url },
          })
        } else if (isDocumentURL(url)) {
          messages.push({
            type: 'file',
            file: { link: url },
          })
        } else {
          messages.push({
            type: 'image',
            image: { link: url, caption: node.alt || 'image' },
          })
        }
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
 * Converts markdown to an array of messenger messages
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_MESSENGER_MESSAGE_LENGTH
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
