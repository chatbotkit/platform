import { joinTrimmedNotEmpty } from '@/lib/string'

import emojiFromText from 'emoji-from-text'
import emojiNameMap from 'emoji-name-map'

export function text2emoji(
  text: string | string[],
  defaultText?: string
): string {
  if (!Array.isArray(text)) {
    text = [text]
  }

  let emoji: string | undefined

  {
    emoji = text[0]

    if (emoji && isEmojiCodePoint(emoji)) {
      return emoji
    }
  }

  {
    emoji = emojiNameMap.get(text[0] || '')

    if (emoji && isEmojiShortCode(text[0])) {
      return emoji
    }
  }

  {
    emoji = emojiNameMap.get(
      emojiFromText(
        joinTrimmedNotEmpty(text) || defaultText || '',
        true
      )?.match?.toString() || ''
    )

    if (emoji) {
      return emoji
    }
  }

  return '🤖'
}

/**
 * Check if a string is an emoji code point.
 */
export function isEmojiCodePoint(text: string): boolean {
  return !!text?.match?.(/^[\p{Emoji}]$/u)
}

/**
 * Check if a string is an emoji short code
 */
export function isEmojiShortCode(text: string): boolean {
  return !!emojiNameMap.get(text || '')
}

/**
 * @ai
 */
export function getEmojiCodePoint(text: string): number {
  const chars = [...text]

  if (chars.length === 0) {
    return 0
  }

  // @note assuming the emoji is the first character (or sequence of characters)
  // and trying to handle cases where an emoji might be followed by a variation
  // selector (65039)

  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0)
    // check if the code point is not a variation selector

    if (cp && cp !== 65039) {
      return cp
    }
  }

  return 0
}
