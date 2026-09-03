import { createHmacHexDigest, timingSafeEqual } from '@/lib/webcrypto'

/**
 * Validates Meta's `X-Hub-Signature-256`, sent on Messenger and Instagram
 * callbacks: `sha256=<hex>` of an HMAC-SHA256 over the RAW request body.
 *
 * @note the key is the Meta APP secret - an application-level credential
 * shared by every integration on the same Meta app, not a per-integration one,
 * which is why the deployment supplies it rather than the integration record.
 *
 * @note re-serialising parsed JSON changes bytes (key order, whitespace,
 * unicode escapes), so this must be given the body exactly as it arrived.
 *
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
 */
export async function verifyMetaSignature({
  rawBody,
  header,
  appSecret,
}: {
  rawBody: string
  header: string | null | undefined
  appSecret: string
}): Promise<boolean> {
  if (!header?.startsWith('sha256=')) {
    return false
  }

  const expected =
    'sha256=' + (await createHmacHexDigest('sha256', appSecret, rawBody))

  return timingSafeEqual(header, expected)
}
