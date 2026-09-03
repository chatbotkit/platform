/**
 * Cross-channel "thinking" indicator copy.
 *
 * Channels that can render a textual working status - Slack's
 * `assistant.threads.setStatus` today, and any future channel with an
 * equivalent - draw the base status verb and the rotating loader lines from
 * here, so the product speaks with one voice regardless of channel. Channels
 * whose only "busy" primitive is a content-free typing ping (e.g. Telegram's
 * `sendChatAction`) ignore the copy and just pulse the ping.
 *
 * The defaults are intentionally generic. Extend them per channel or per
 * integration with {@link composeThinkingLoadingMessages}, which merges,
 * de-duplicates and caps the result so it is always safe to hand to a channel
 * API.
 */

// @note the short status verb shown while the bot works. Phrased to read
// naturally after the bot's name in channels that prefix it - Slack renders
// this as "<bot> is thinking...".
export const THINKING_STATUS = 'is thinking...'

// @note default rotating loader lines shown while a turn is in flight, ordered
// as a loose progression because channels that rotate (Slack) step through them
// in order. Kept channel-agnostic; a channel or integration layers its own on
// top via composeThinkingLoadingMessages rather than editing this list.
//
// Channels enforce their own ceiling at the API boundary, so this list can grow
// past any single channel's limit without breaking that channel - it just means
// the tail may not be reached there.
export const THINKING_LOADING_MESSAGES: string[] = [
  'Gathering context...',
  'Reading through the details...',
  'Consulting the knowledge base...',
  'Checking my sources...',
  'Connecting the dots...',
  'Working through the specifics...',
  'Weighing the options...',
  'Double-checking the facts...',
  'Pulling the threads together...',
  'Putting together a response...',
]

// @note Slack caps `loading_messages` at 10; use that as the channel-agnostic
// ceiling so any composed list is safe to send everywhere.
export const MAX_THINKING_LOADING_MESSAGES = 10

/** Trim, drop empties, de-duplicate (first occurrence wins). */
function clean(messages: readonly string[]): string[] {
  const seen = new Set<string>()

  const out: string[] = []

  for (const message of messages) {
    const trimmed = message?.trim()

    if (!trimmed || seen.has(trimmed)) {
      continue
    }

    seen.add(trimmed)

    out.push(trimmed)
  }

  return out
}

/**
 * Compose the effective loader lines for a turn: the shared defaults (or a
 * caller-supplied `base`) followed by any channel- or integration-specific
 * additions, trimmed, de-duplicated and capped at `max`.
 *
 * Extras are reserved against the cap and the defaults yield slots to fit them.
 * The defaults are generic filler and the shared list is sized to fill a
 * channel's whole ceiling on its own, so appending-then-truncating would
 * silently drop exactly the copy a caller went out of its way to add.
 *
 * @param extra - channel/integration-specific lines, kept even when the base
 *   already fills the cap
 * @param options.base - the lines extras extend (defaults to the shared
 *   {@link THINKING_LOADING_MESSAGES})
 * @param options.max - hard ceiling on the returned list length (defaults to
 *   {@link MAX_THINKING_LOADING_MESSAGES})
 */
export function composeThinkingLoadingMessages(
  extra: readonly string[] = [],
  {
    base = THINKING_LOADING_MESSAGES,
    max = MAX_THINKING_LOADING_MESSAGES,
  }: { base?: readonly string[]; max?: number } = {}
): string[] {
  const extras = clean(extra).slice(0, max)

  const defaults = clean(base).filter((message) => !extras.includes(message))

  // @note trim the tail of the progression rather than its opening lines - a
  // turn is far more likely to show the first few than to reach the last
  return [...defaults.slice(0, Math.max(0, max - extras.length)), ...extras]
}
