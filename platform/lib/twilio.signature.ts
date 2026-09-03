import { createHmacHexDigest, timingSafeEqual } from '@/lib/webcrypto'

/**
 * Validates Twilio's `X-Twilio-Signature`: a base64 HMAC-SHA1, keyed with the
 * account auth token, over the full request URL followed by every POST
 * parameter appended as key then value, sorted by key.
 *
 * @note the url must be the one Twilio signed - the PUBLIC callback url,
 * including protocol and any query string. Behind a proxy the request's own
 * host is not that url, which is why the caller passes it explicitly rather
 * than reading it off the request.
 *
 * @note the signature covers the parameters, so it must be checked against the
 * parsed form body rather than a re-serialised one.
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function verifyTwilioSignature({
  url,
  params,
  header,
  authToken,
}: {
  url: string
  params: Record<string, string>
  header: string | null | undefined
  authToken: string
}): Promise<boolean> {
  if (!header) {
    return false
  }

  const data = Object.keys(params)
    .sort()
    .reduce((carry, key) => carry + key + params[key], url)

  const digest = await createHmacHexDigest('sha1', authToken, data)

  // @note Twilio sends base64 while the shared helper returns hex, so the
  // digest is converted rather than the header decoded - a malformed header
  // then fails the comparison instead of throwing
  const expected = Buffer.from(digest, 'hex').toString('base64')

  return timingSafeEqual(header, expected)
}
