/**
 * Represents a parsed entry from a Slack allowFrom list.
 */
type AllowFromEntry =
  | { type: 'userId'; id: string }
  | { type: 'channelId'; id: string }
  | { type: 'username'; username: string }
  | { type: 'channelName'; name: string }
  | { type: 'wildcard' }

/**
 * Returns true if the string looks like a Slack user ID (U… or W…).
 *
 * @note Slack user IDs are uppercase alphanumeric, starting with U or W.
 * Enterprise Grid workspace users start with W. Both are treated as userId.
 */
function isSlackUserId(value: string): boolean {
  return /^[UW][A-Z0-9]+$/.test(value.toUpperCase()) && value.length >= 9
}

/**
 * Returns true if the string looks like a Slack channel/group/DM ID (C…, G…, D…).
 *
 * @note C = public channel, G = private group/channel, D = direct message
 */
function isSlackChannelId(value: string): boolean {
  return /^[CGD][A-Z0-9]+$/.test(value.toUpperCase()) && value.length >= 9
}

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`              - wildcard, allow all senders
 * - `@U12345678`     - Slack user ID with @ prefix
 * - `@W12345678`     - Slack workspace user ID with @ prefix
 * - `U12345678`      - raw Slack user ID (no prefix)
 * - `W12345678`      - raw Slack workspace user ID (no prefix)
 * - `#C12345678`     - Slack channel ID with # prefix
 * - `#G12345678`     - Slack private group ID with # prefix
 * - `#D12345678`     - Slack DM ID with # prefix
 * - `C12345678`      - raw Slack channel ID (no prefix)
 * - `@username`      - Slack username, advisory (can change, case-insensitive)
 * - `#channel-name`  - Slack channel name, advisory (can change, case-insensitive)
 *
 * @note Username and channel-name matching is advisory: they can be renamed or
 * transferred. Use Slack IDs for security-sensitive restrictions.
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

    // @note check if rest looks like a Slack user ID (U… or W…)
    if (isSlackUserId(rest)) {
      return { type: 'userId', id: rest.toUpperCase() }
    }

    return { type: 'username', username: rest.toLowerCase() }
  }

  if (entry.startsWith('#')) {
    const rest = entry.slice(1)

    if (!rest) {
      return null
    }

    // @note check if rest looks like a Slack channel ID (C…, G…, D…)
    if (isSlackChannelId(rest)) {
      return { type: 'channelId', id: rest.toUpperCase() }
    }

    return { type: 'channelName', name: rest.toLowerCase() }
  }

  // no prefix - check if raw Slack ID
  if (isSlackUserId(entry)) {
    return { type: 'userId', id: entry.toUpperCase() }
  }

  if (isSlackChannelId(entry)) {
    return { type: 'channelId', id: entry.toUpperCase() }
  }

  return null
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string)
 * into a list of structured entries. Invalid or blank entries are silently
 * skipped.
 */
export function parseSlackAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map(parseAllowFromEntry)
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Checks whether a message sender/channel is permitted by the allowFrom list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise → allow if ANY entry matches the userId, channelId, username, or channelName
 *
 * @param sender.userId      The Slack `user` field (sender's user ID, e.g. U12345678)
 * @param sender.channelId   The Slack `channel` or `channelId` field (e.g. C12345678)
 * @param sender.username    The Slack username of the sender, if available
 * @param sender.channelName The Slack channel name, if available
 * @param entries            Parsed entries from `parseSlackAllowFrom`
 *
 * @note empty list means deny all - use '*' to explicitly allow everyone
 */
export function slackSenderIsAllowed(
  sender: {
    userId: string
    channelId: string
    username?: string
    channelName?: string
  },
  entries: AllowFromEntry[]
): boolean {
  const { userId, channelId, username, channelName } = sender

  if (entries.length === 0) {
    return false
  }

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'userId':
        return entry.id === userId.toUpperCase()

      case 'channelId':
        return entry.id === channelId.toUpperCase()

      case 'username':
        return (
          username !== undefined && username.toLowerCase() === entry.username
        )

      case 'channelName':
        return (
          channelName !== undefined && channelName.toLowerCase() === entry.name
        )
    }
  })
}
