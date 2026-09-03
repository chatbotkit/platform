// @note Teams has a practical message size limit of ~4000 characters
const MAX_MESSAGE_LENGTH = 4000

interface TextMessage {
  type: 'text'
  text: string
}

type Message = TextMessage

/**
 * Strips `<at>...</at>` mention tags that Teams wraps around @mentions.
 *
 * @note In group chats Teams wraps every mention in `<at>BotName</at>` HTML
 * tags. These need to be removed so the AI only sees the actual message text.
 */
export function stripMentionTags(text: string): string {
  return text.replace(/<at[^>]*>.*?<\/at>/gi, '').trim()
}

/**
 * Normalizes a Teams conversation ID by stripping the `";messageid=..."`
 * suffix that Teams sometimes appends.
 *
 * @note Without normalization, the same conversation can produce different IDs
 * which leads to duplicate sessions in Redis.
 */
export function normalizeConversationId(conversationId: string): string {
  return conversationId.split(';')[0] || conversationId
}

/**
 * Splits a long message into chunks that fit within the Teams message size
 * limit (~4000 characters). Splits on paragraph boundaries when possible,
 * falling back to hard splits when a single paragraph exceeds the limit.
 */
export function chunkText(
  text: string,
  maxLength: number = MAX_MESSAGE_LENGTH
): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)

      break
    }

    // @note try to split on a double newline (paragraph boundary) first
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength)

    // @note fall back to single newline
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('\n', maxLength)
    }

    // @note fall back to space
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', maxLength)
    }

    // @note hard split if no good boundary found
    if (splitIndex <= 0) {
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex).trimEnd())

    remaining = remaining.slice(splitIndex).trimStart()
  }

  return chunks.filter((c) => c.length > 0)
}

/**
 * Converts markdown to an array of Teams messages.
 *
 * @note Teams supports a subset of markdown in messages. Bold, italic, links,
 * and code blocks work natively. Some advanced markdown features like tables
 * may need Adaptive Cards for full rendering.
 *
 * @note Long messages are automatically split into chunks that fit within
 * the Teams message size limit.
 */
export async function markdownToMessages(markdown: string): Promise<Message[]> {
  const chunks = chunkText(markdown)

  return chunks.map((text) => ({ type: 'text', text }))
}
