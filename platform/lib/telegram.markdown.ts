import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

export const MAX_TELEGRAM_MESSAGE_LENGTH = 4096

interface TextMessage {
  type: 'text'
  text: string
}

interface ImageMessage {
  type: 'image'
  image: string
}

interface VideoMessage {
  type: 'video'
  video: string
}

interface AudioMessage {
  type: 'audio'
  audio: string
}

interface VoiceMessage {
  type: 'voice'
  voice: string
}

interface FileMessage {
  type: 'file'
  file: string
}

type Message =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | AudioMessage
  | VoiceMessage
  | FileMessage

interface Node {
  type: string
  value: string
  lang?: string
  url?: string
  alt?: string
  ordered?: boolean
  checked?: boolean | null
  identifier?: string
  children?: Node[]
}

/**
 * Escapes special markdown characters for Telegram
 */
export function escape(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!')
}

/**
 * Escapes URL characters that break Telegram MarkdownV2 inline links.
 */
export function escapeLinkURL(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

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
      return escape(node.value)
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
      return `\`${escape(node.value)}\``
    }
    case 'code': {
      return `\`\`\`${node.lang || ''}\n${escape(node.value)}\n\`\`\``
    }
    case 'break': {
      return '\n'
    }
    case 'link': {
      const text = node.children
        ?.map(extractInlineText.bind(null, definitions))
        .join('')
      const url = node.url ? escapeLinkURL(node.url) : ''

      if (text && url) {
        return `[${text}](${url})`
      }

      return escape(node.url || '')
    }
    case 'linkReference': {
      const text = node.children
        ?.map(extractInlineText.bind(null, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      if (text && url) {
        return `[${text}](${escapeLinkURL(url)})`
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

function isVoiceAltText(alt: string | undefined): boolean {
  return (alt || '').trim().replace(/[\s_-]+/g, '').toLowerCase() === 'voicenote'
}

function isDocumentURL(url: string): boolean {
  return (
    /^https?:\/\//.test(url) &&
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|rtf|odt|ods|odp|zip|rar|7z)(\?.*)?$/i.test(
      url
    )
  )
}

/**
 * Converts a markdown AST node to telegram messages
 */
function convertNode(
  messages: Message[],
  definitions: Map<string, string>,
  node: Node
): string {
  switch (node.type) {
    case 'heading': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')

      if (text) {
        messages.push({ type: 'text', text: `*${text}*` })
      }

      return ''
    }

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
        text: `\`\`\`${node.lang}\n${escape(node.value)}\n\`\`\``,
      })

      return ''
    }

    case 'inlineCode': {
      return `\`${escape(node.value)}\``
    }

    case 'break': {
      return '\n'
    }

    case 'link': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
      const url = node.url ? escapeLinkURL(node.url) : ''
      const escapedURLText = escape(node.url || '')

      // @note autolink literals should remain plain text to preserve prior behavior
      if (text && url && text === escapedURLText) {
        return escapedURLText
      }

      if (text && url) {
        return `[${text}](${url})`
      }

      return escapedURLText
    }

    case 'linkReference': {
      const text = node.children
        ?.map(convertNode.bind(null, messages, definitions))
        .join('')
      const url = definitions.get(node.identifier ?? '')

      if (text && url) {
        return `[${text}](${escapeLinkURL(url)})`
      }

      return text || ''
    }

    case 'definition': {
      return ''
    }

    case 'image': {
      if (node.url && /^https?:\/\//.test(node.url)) {
        if (isVoiceAltText(node.alt) && isAudioURL(node.url)) {
          messages.push({ type: 'voice', voice: node.url })
        } else if (isVideoURL(node.url)) {
          messages.push({ type: 'video', video: node.url })
        } else if (isAudioURL(node.url)) {
          messages.push({ type: 'audio', audio: node.url })
        } else if (isDocumentURL(node.url)) {
          messages.push({ type: 'file', file: node.url })
        } else {
          messages.push({ type: 'image', image: node.url })
        }
      }

      return ''
    }

    case 'imageReference': {
      const url = definitions.get(node.identifier ?? '')

      if (url && /^https?:\/\//.test(url)) {
        if (isVoiceAltText(node.alt) && isAudioURL(url)) {
          messages.push({ type: 'voice', voice: url })
        } else if (isVideoURL(url)) {
          messages.push({ type: 'video', video: url })
        } else if (isAudioURL(url)) {
          messages.push({ type: 'audio', audio: url })
        } else if (isDocumentURL(url)) {
          messages.push({ type: 'file', file: url })
        } else {
          messages.push({ type: 'image', image: url })
        }
      }

      return ''
    }

    case 'list': {
      const listMedia: Message[] = []

      const extractListItemText = (listNode: Node): string => {
        switch (listNode.type) {
          case 'paragraph':
          case 'listItem': {
            return listNode.children?.map(extractListItemText).join('') || ''
          }
          case 'text': {
            return escape(listNode.value)
          }
          case 'strong': {
            return `*${listNode.children?.map(extractListItemText).join('')}*`
          }
          case 'emphasis': {
            return `_${listNode.children?.map(extractListItemText).join('')}_`
          }
          case 'delete': {
            return `~${listNode.children?.map(extractListItemText).join('')}~`
          }
          case 'inlineCode': {
            return `\`${escape(listNode.value)}\``
          }
          case 'code': {
            return `\`\`\`${listNode.lang || ''}\n${escape(listNode.value)}\n\`\`\``
          }
          case 'link': {
            const text = listNode.children?.map(extractListItemText).join('')
            const url = listNode.url ? escapeLinkURL(listNode.url) : ''

            if (text && url) {
              return `[${text}](${url})`
            }

            return escape(listNode.url || '')
          }
          case 'image': {
            if (listNode.url && /^https?:\/\//.test(listNode.url)) {
              if (isVoiceAltText(listNode.alt) && isAudioURL(listNode.url)) {
                listMedia.push({ type: 'voice', voice: listNode.url })
              } else if (isVideoURL(listNode.url)) {
                listMedia.push({ type: 'video', video: listNode.url })
              } else if (isAudioURL(listNode.url)) {
                listMedia.push({ type: 'audio', audio: listNode.url })
              } else if (isDocumentURL(listNode.url)) {
                listMedia.push({ type: 'file', file: listNode.url })
              } else {
                listMedia.push({ type: 'image', image: listNode.url })
              }
            }

            return ''
          }
          case 'linkReference': {
            const text = listNode.children?.map(extractListItemText).join('')
            const url = definitions.get(listNode.identifier ?? '')

            if (text && url) {
              return `[${text}](${escapeLinkURL(url)})`
            }

            return text || ''
          }
          case 'definition': {
            return ''
          }
          default: {
            return listNode.children?.map(extractListItemText).join('') || ''
          }
        }
      }

      const listItems = node.children
        ?.map((item, index) => {
          const text = extractListItemText(item).trim()

          if (!text) {
            return ''
          }

          if (!node.ordered && item.checked === true) {
            return `✅ ${text}`
          }

          if (!node.ordered && item.checked === false) {
            return `⬜ ${text}`
          }

          return node.ordered ? `${index + 1}\\. ${text}` : `• ${text}`
        })
        .filter(Boolean)
        .join('\n')

      if (listItems) {
        messages.push({ type: 'text', text: listItems })
      }

      if (listMedia.length) {
        messages.push(...listMedia)
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
      const quoted = text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')

      if (quoted) {
        messages.push({ type: 'text', text: quoted })
      }

      return ''
    }

    case 'thematicBreak': {
      messages.push({ type: 'text', text: escape('---') })

      return ''
    }

    case 'table': {
      const rows =
        node.children
          ?.filter((row) => row.type === 'tableRow')
          .map((row, rowIndex) => {
            const cells =
              row.children
                ?.filter((cell) => cell.type === 'tableCell')
                .map((cell) => {
                  const cellText = (
                    cell.children
                      ?.map(extractInlineText.bind(null, definitions))
                      .join('') || ''
                  ).trim()

                  return rowIndex === 0 ? `*${cellText}*` : cellText
                }) || []

            return cells.join(' \\| ')
          })
          .filter(Boolean) || []

      if (rows.length > 0) {
        messages.push({ type: 'text', text: rows.join('\n') })
      }

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

  for (const child of tree.children ?? []) {
    if (child.type === 'definition' && child.identifier && child.url) {
      definitions.set(child.identifier, child.url)
    }
  }

  return definitions
}

/**
 * Converts markdown to an array of telegram messages.
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_TELEGRAM_MESSAGE_LENGTH
): Promise<Message[]> {
  const processor = unified().use(remarkParse).use(remarkGfm)

  const tree = processor.parse(markdown) as Node

  const definitions = collectDefinitions(tree)

  const messages: Message[] = []

  tree.children?.map(convertNode.bind(null, messages, definitions))

  return splitMessagesBySize(messages, maxLength)
}
