/**
 * Represents a parsed entry from an allowFrom list.
 */
type AllowFromEntry =
  | { type: 'userId'; id: number }
  | { type: 'chatId'; id: number }
  | { type: 'username'; username: string }
  | { type: 'wildcard' }

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`              - wildcard, allow all senders
 * - `@bob`           - match by Telegram username (case-insensitive, advisory)
 * - `@111222333`     - numeric after @, match by user ID (reliable)
 * - `#-1001234567`   - match by chat ID (groups/supergroups/channels have negative IDs)
 * - `111222333`      - positive raw integer, treated as user ID
 * - `-1001234567`    - negative raw integer, treated as chat ID
 *
 * @note Username matching (`@bob`) is advisory: usernames can be changed or
 * transferred. Use numeric IDs for security-sensitive restrictions.
 */
function parseAllowFromEntry(entry: string): AllowFromEntry | null {
  entry = entry.trim()

  if (!entry) {
    return null
  }

  if (entry === '*') {
    return { type: 'wildcard' }
  }

  if (entry.startsWith('@')) {
    const rest = entry.slice(1)

    if (!rest) {
      return null
    }

    const num = Number(rest)

    // @note check that it's a clean integer string (no decimals, no leading zeros etc.)
    if (Number.isInteger(num) && String(num) === rest) {
      return { type: 'userId', id: num }
    }

    return { type: 'username', username: rest.toLowerCase() }
  }

  if (entry.startsWith('#')) {
    const rest = entry.slice(1)

    if (!rest) {
      return null
    }

    const num = Number(rest)

    if (Number.isInteger(num) && !isNaN(num)) {
      return { type: 'chatId', id: num }
    }

    return null
  }

  // raw integer - positive = user, negative = chat
  const num = Number(entry)

  if (Number.isInteger(num) && !isNaN(num) && entry.length > 0) {
    if (num >= 0) {
      return { type: 'userId', id: num }
    } else {
      return { type: 'chatId', id: num }
    }
  }

  return null
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string)
 * into a list of structured entries. Invalid or blank entries are silently
 * skipped.
 */
export function parseTelegramAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map((e) => parseAllowFromEntry(e))
    .filter((e): e is AllowFromEntry => e !== null)
}

/**
 * Checks whether a message sender/chat is permitted by the allowFrom list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise → allow if ANY entry matches the userId, chatId, or username
 *
 * @param userId   The Telegram `from.id` of the message sender
 * @param chatId   The Telegram `chat.id` where the message was sent
 * @param username The Telegram `from.username`, if present
 * @param entries  Parsed entries from `parseTelegramAllowFrom`
 */
export function telegramSenderIsAllowed(
  userId: number,
  chatId: number,
  username: string | undefined,
  entries: AllowFromEntry[]
): boolean {
  // @note empty list means deny all - use '*' to explicitly allow everyone

  if (entries.length === 0) {
    return false
  }

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'userId':
        return entry.id === userId

      case 'chatId':
        return entry.id === chatId

      case 'username':
        return (
          username !== undefined && username.toLowerCase() === entry.username
        )
    }
  })
}
