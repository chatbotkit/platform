/**
 * Represents a parsed entry from a Teams allowFrom list.
 */
type AllowFromEntry = { type: 'userId'; id: string } | { type: 'wildcard' }

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`          - wildcard, allow all senders
 * - `29:1abc...` - Teams user ID (e.g. `29:1AbcDef123`)
 * - Any string   - treated as an opaque Teams user ID for exact match
 *
 * @note Teams delivers the sender's ID in `payload.fromId` with the format
 * `29:1<base64>` for individual users. Matching is case-insensitive since
 * the same ID may appear in different cases across Teams environments.
 *
 * @note Empty entries are silently discarded.
 */
function parseAllowFromEntry(entry: string): AllowFromEntry | null {
  entry = entry.trim()

  if (!entry) {
    return null
  }

  if (entry === '*') {
    return { type: 'wildcard' }
  }

  return { type: 'userId', id: entry.toLowerCase() }
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string)
 * into a list of structured entries. Blank entries are silently skipped.
 */
export function parseTeamsAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map(parseAllowFromEntry)
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Checks whether a Teams message sender is permitted by the allowFrom list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise → allow if ANY entry matches the sender's `fromId`
 *
 * @param fromId  The Teams `fromId` field value (e.g. `29:1AbcDef123`)
 *                as delivered by the Microsoft Bot Framework
 * @param entries Parsed entries from `parseTeamsAllowFrom`
 */
export function teamsFromIsAllowed(
  fromId: string,
  entries: AllowFromEntry[]
): boolean {
  // @note empty list means deny all - use '*' to explicitly allow everyone

  if (entries.length === 0) {
    return false
  }

  const normalizedFrom = fromId.toLowerCase()

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'userId':
        return entry.id === normalizedFrom
    }
  })
}
