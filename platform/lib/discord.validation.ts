/**
 * Represents a parsed entry from a Discord allowFrom list.
 */
type AllowFromEntry =
  | { type: 'userId'; id: string }
  | { type: 'username'; username: string }
  | { type: 'wildcard' }

/**
 * Returns true if the string looks like a Discord user ID (snowflake).
 *
 * @note Discord snowflake IDs are all-digit strings of 15 or more characters.
 */
function isDiscordUserId(value: string): boolean {
  return /^\d+$/.test(value) && value.length >= 15
}

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`                    - wildcard, allow all senders
 * - `@123456789012345678`  - Discord user snowflake ID with @ prefix
 * - `123456789012345678`   - raw Discord user snowflake ID (no prefix)
 * - `@username`            - Discord username, advisory (can change, case-insensitive)
 *
 * @note Username matching is advisory: Discord usernames can be changed. Use
 * snowflake IDs for security-sensitive restrictions.
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

    // @note check if rest looks like a Discord snowflake user ID (all digits, >=15 chars)
    if (isDiscordUserId(rest)) {
      return { type: 'userId', id: rest }
    }

    return { type: 'username', username: rest.toLowerCase() }
  }

  // no prefix - check if raw Discord snowflake user ID
  if (isDiscordUserId(entry)) {
    return { type: 'userId', id: entry }
  }

  return null
}

/**
 * Parses a newline- and/or comma-separated allowFrom string into an array of
 * structured entries.
 *
 * @note Invalid or empty lines are silently skipped.
 */
export function parseDiscordAllowFrom(input: string): AllowFromEntry[] {
  if (!input || !input.trim()) {
    return []
  }

  return input
    .split(/[\n,]+/)
    .map((line) => parseAllowFromEntry(line.trim()))
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Returns true if the given sender is allowed according to the parsed
 * allowFrom entries.
 *
 * Matching rules (in order):
 * 1. Wildcard entry - always allow.
 * 2. userId entry   - match against `sender.userId` (exact string).
 * 3. username entry - match against `sender.username` (case-insensitive) if provided.
 *
 * @note If entries is empty, the function returns false (deny all).
 */
export function discordSenderIsAllowed(
  sender: { userId: string; username?: string },
  entries: AllowFromEntry[]
): boolean {
  for (const entry of entries) {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'userId':
        if (entry.id === sender.userId) {
          return true
        }

        break

      case 'username':
        if (
          sender.username &&
          entry.username === sender.username.toLowerCase()
        ) {
          return true
        }

        break
    }
  }

  return false
}
