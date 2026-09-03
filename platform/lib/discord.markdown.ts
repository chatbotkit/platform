import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'

// @see https://discord.com/developers/docs/resources/message#create-message-jsonform-params
// Discord rejects any message whose `content` exceeds this many characters with
// "Invalid Form Body".
export const MAX_DISCORD_MESSAGE_LENGTH = 2000

interface TextMessage {
  type: 'text'
  text: string
}

type Message = TextMessage

/**
 * Converts markdown to an array of discord messages, splitting any content that
 * exceeds Discord's per-message character limit into multiple messages.
 *
 * @note Discord renders standard markdown natively, so unlike the other
 * platform converters there is no syntax transformation - the text is passed
 * through and only split on size, keeping top-level markdown blocks (code
 * fences, lists, tables) intact where possible.
 */
export async function markdownToMessages(
  markdown: string,
  maxLength: number = MAX_DISCORD_MESSAGE_LENGTH
): Promise<Message[]> {
  if (markdown.length <= maxLength) {
    return [{ type: 'text', text: markdown }]
  }

  return splitTextByTopLevelBlocksToSize(markdown, maxLength)
    .filter(Boolean)
    .map((text) => ({ type: 'text', text }))
}
