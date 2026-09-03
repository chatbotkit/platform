import erx from 'emoji-regex'

export const emojiRegex = erx()

export const newEmojiRegex = erx

export function isEmoji(text: string): boolean {
  // @note we use `new` here to get a new instance of the regex with fresh state
  // because the regex is stateful and maintains state across calls which can
  // lead to incorrect results when using the same instance multiple times

  const result = newEmojiRegex().test(text)

  return result
}
