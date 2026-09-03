/**
 * Represents a parsed entry from a Google Chat allowFrom list.
 */
type AllowFromEntry = { type: 'userId'; id: string } | { type: 'wildcard' }

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`              - wildcard, allow all senders
 * - `users/USER_ID`  - Google Chat user resource name
 *
 * @note Unrecognised entries are silently discarded. Display name matching is
 * intentionally not supported - display names are mutable and non-unique,
 * making them trivially spoofable. Use `users/USER_ID` resource names.
 */
function parseAllowFromEntry(entry: string): AllowFromEntry | null {
  entry = entry.trim()

  if (!entry) {
    return null
  }

  if (entry === '*') {
    return { type: 'wildcard' }
  }

  if (entry.startsWith('users/')) {
    return { type: 'userId', id: entry.toLowerCase() }
  }

  // @note anything that isn't a wildcard or a users/ resource name is silently
  // discarded rather than matched - fail-safe over fail-open
  return null
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string) into
 * a list of structured entries. Blank entries are silently skipped.
 */
export function parseGoogleChatAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map(parseAllowFromEntry)
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Represents a Google Chat message sender for allowFrom checks.
 */
export interface GoogleChatSender {
  name: string
}

/**
 * Checks whether a Google Chat message sender is permitted by the allowFrom
 * list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise  → allow if ANY entry matches the sender
 *
 * @param sender  The sender (resource name, e.g. "users/USER_ID")
 * @param entries Parsed entries from `parseGoogleChatAllowFrom`
 */
export function googleChatSenderIsAllowed(
  sender: GoogleChatSender,
  entries: AllowFromEntry[]
): boolean {
  // @note empty list means deny all - use '*' to explicitly allow everyone

  if (entries.length === 0) {
    return false
  }

  const normalizedName = sender.name.toLowerCase()

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'userId':
        return entry.id === normalizedName
    }
  })
}
