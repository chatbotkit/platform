import parsePhoneNumberFromString from 'libphonenumber-js'

const TWILIO_CHANNEL_ADDRESS_RE = /^([a-z][a-z0-9_-]*:)(.+)$/i
const TWILIO_ALPHANUMERIC_SENDER_RE = /^[a-z0-9 ._-]{1,11}$/i

/**
 * Normalizes a human-entered phone number into Twilio's preferred E.164 shape.
 *
 * @note Twilio API sends are strict about phone numbers. We accept common UI
 * formatting, including spaces and `00` international prefixes, but store/send
 * the canonical `+...` value.
 */
export function normalizeTwilioPhoneNumber(value: string): string | null {
  const text = value.trim()

  if (!text) {
    return null
  }

  const normalizedText = text.startsWith('00') ? `+${text.slice(2)}` : text

  const phoneNumber = parsePhoneNumberFromString(normalizedText, {
    defaultCountry: 'US',
  })

  if (!phoneNumber?.isValid()) {
    return null
  }

  return phoneNumber.number.toString()
}

/**
 * Normalizes a Twilio message address. This is usually a phone number, but can
 * also be a channel-prefixed address such as `whatsapp:+447...`.
 */
export function normalizeTwilioMessageAddress(
  value: string,
  {
    allowAlphanumericSender = false,
  }: {
    allowAlphanumericSender?: boolean
  } = {}
): string | null {
  const text = value.trim()

  if (!text) {
    return null
  }

  const channelMatch = text.match(TWILIO_CHANNEL_ADDRESS_RE)

  if (channelMatch) {
    const phoneNumber = normalizeTwilioPhoneNumber(channelMatch[2])

    return phoneNumber ? `${channelMatch[1]}${phoneNumber}` : null
  }

  const phoneNumber = normalizeTwilioPhoneNumber(text)

  if (phoneNumber) {
    return phoneNumber
  }

  if (allowAlphanumericSender && TWILIO_ALPHANUMERIC_SENDER_RE.test(text)) {
    return text
  }

  return null
}
