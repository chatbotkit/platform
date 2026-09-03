import { type AnyRequest, getHeader } from '@/lib/header'
import { createHmacHexDigest } from '@/lib/webcrypto'

/**
 * Validates a GitHub webhook signature.
 *
 * GitHub signs the raw request body with HMAC-SHA256 using the webhook secret
 * and sends the result in the `x-hub-signature-256` header as `sha256=<hex>`.
 * This mirrors the Slack signature validation but uses GitHub's scheme.
 */
export async function validateGithubSignature(
  requestBody: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  const computedSignature =
    'sha256=' +
    (await createHmacHexDigest('sha256', webhookSecret, requestBody))

  if (!timingSafeEqual(signature, computedSignature)) {
    throw new Error('Invalid signature')
  }

  return true
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares two strings in constant time regardless of content.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Extracts and validates the required GitHub signature header from a request.
 *
 * @throws {Error} if the header is missing or malformed.
 */
export function extractGithubSignature(req: AnyRequest): string {
  const signature = getHeader(req, 'x-hub-signature-256')

  if (!signature) {
    throw new Error('Missing X-Hub-Signature-256 header')
  }

  if (!signature.startsWith('sha256=')) {
    throw new Error('Invalid signature format')
  }

  return signature
}

/**
 * Complete GitHub request validation including header extraction and HMAC
 * signature verification over the raw body.
 */
export async function validateGithubRequest(
  req: AnyRequest,
  rawBody: string,
  webhookSecret: string
): Promise<boolean> {
  const signature = extractGithubSignature(req)

  return await validateGithubSignature(rawBody, signature, webhookSecret)
}
