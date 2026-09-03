/**
 * Represents a parsed entry from a WhatsApp allowFrom list.
 */
type AllowFromEntry = { type: 'phone'; digits: string } | { type: 'wildcard' }

/**
 * Strips all non-digit characters from a string, returning only the digit
 * portion of a phone number.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Parses a single allowFrom entry string into a structured form.
 *
 * Supported formats:
 * - `*`             - wildcard, allow all senders
 * - `+12025551234`  - E.164 phone number with `+` prefix
 * - `12025551234`   - E.164 digits without `+` prefix
 *
 * @note WhatsApp delivers the sender's phone number as digits without a `+`
 * sign (e.g. `"12025551234"`). Both `+` prefixed and unprefixed entries are
 * normalised to digit-only strings before comparison, so both forms are
 * equivalent.
 *
 * @note Only plausible E.164 lengths (7–15 digits) are accepted. Anything
 * shorter or longer is silently discarded.
 */
function parseAllowFromEntry(entry: string): AllowFromEntry | null {
  entry = entry.trim()

  if (!entry) {
    return null
  }

  if (entry === '*') {
    return { type: 'wildcard' }
  }

  const digits = digitsOnly(entry)

  // E.164 numbers are 7–15 digits (including country code)
  if (digits.length < 7 || digits.length > 15) {
    return null
  }

  return { type: 'phone', digits }
}

/**
 * Parses the `allowFrom` field value (newline or comma-separated string)
 * into a list of structured entries. Invalid or blank entries are silently
 * skipped.
 */
export function parseWhatsAppAllowFrom(input: string): AllowFromEntry[] {
  return input
    .split(/[\n,]+/)
    .map(parseAllowFromEntry)
    .filter((entry): entry is AllowFromEntry => entry !== null)
}

/**
 * Checks whether a WhatsApp message sender is permitted by the allowFrom list.
 *
 * - Empty list → deny all (secure by default; use `*` to allow everyone)
 * - Otherwise → allow if ANY entry matches the sender's phone number
 *
 * @param from    The WhatsApp `from` field value - a digits-only E.164 string
 *                (e.g. `"12025551234"`) as delivered by the Meta Webhooks API
 * @param entries Parsed entries from `parseWhatsAppAllowFrom`
 */
export function whatsAppSenderIsAllowed(
  from: string,
  entries: AllowFromEntry[]
): boolean {
  // @note empty list means deny all - use '*' to explicitly allow everyone

  if (entries.length === 0) {
    return false
  }

  const fromDigits = digitsOnly(from)

  return entries.some((entry) => {
    switch (entry.type) {
      case 'wildcard':
        return true

      case 'phone':
        return entry.digits === fromDigits
    }
  })
}
