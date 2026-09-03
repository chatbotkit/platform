import { createHmacHexDigest, timingSafeEqual } from '@/lib/webcrypto'

// @note Recall delivers webhooks through Svix, which signs every delivery with
// the endpoint's secret (`whsec_<base64>`): HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${raw body}`, keyed with the DECODED secret,
// carried base64 in `svix-signature` as a space-separated list of `v1,<sig>`
// entries (several during a secret rotation). The timestamp is checked against
// a tolerance so a captured delivery cannot be replayed later.
//
// @see https://docs.recall.ai/docs/webhook-security
// @see https://www.standardwebhooks.com/

export const RECALL_SIGNATURE_TOLERANCE_SECONDS = 5 * 60

/**
 * Verifies a Recall (Svix) webhook delivery.
 *
 * @param now - seconds since the epoch; injectable for tests
 */
export async function verifyRecallSignature({
  rawBody,
  svixId,
  svixTimestamp,
  svixSignature,
  webhookSecret,
  now = Math.floor(Date.now() / 1000),
}: {
  rawBody: string
  svixId: string | null | undefined
  svixTimestamp: string | null | undefined
  svixSignature: string | null | undefined
  webhookSecret: string
  now?: number
}): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) {
    return false
  }

  const timestamp = Number.parseInt(svixTimestamp, 10)

  if (!Number.isFinite(timestamp)) {
    return false
  }

  if (Math.abs(now - timestamp) > RECALL_SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }

  // @note the secret is base64 after its `whsec_` prefix; the key is the
  // decoded bytes, not the text
  const secret = Buffer.from(
    webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret,
    'base64'
  ).toString('latin1')

  const digest = await createHmacHexDigest(
    'sha256',
    secret,
    `${svixId}.${svixTimestamp}.${rawBody}`
  )

  const expected = Buffer.from(digest, 'hex').toString('base64')

  // @note any one matching `v1` entry verifies - the list carries both the
  // old and the new signature while a secret is being rotated
  for (const entry of svixSignature.split(' ')) {
    const [version, signature] = entry.split(',', 2)

    if (version === 'v1' && timingSafeEqual(signature, expected)) {
      return true
    }
  }

  return false
}
