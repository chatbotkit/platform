import { type AnyRequest, getHeader } from '@/lib/header'
import { createHmacHexDigest, timingSafeEqual } from '@/lib/webcrypto'

interface SlackHeaders {
  timestamp: string
  signature: string
}

/**
 * Validates Slack webhook signature according to Slack's security guidelines.
 * Implements timestamp validation to prevent replay attacks and HMAC-SHA256
 * signature verification to ensure payload authenticity.
 */
export async function validateSlackSignature(
  requestBody: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  // 1. Check timestamp freshness (prevent replay attacks)
  const currentTime = Math.floor(Date.now() / 1000)
  const requestTimestamp = parseInt(timestamp, 10)

  if (isNaN(requestTimestamp)) {
    throw new Error('Invalid timestamp format')
  }

  // @note slack recommends 5 minutes tolerance to account for clock skew
  if (Math.abs(currentTime - requestTimestamp) > 300) {
    throw new Error('Request timestamp too old')
  }

  // 2. Create signature base string
  const baseString = `v0:${timestamp}:${requestBody}`

  // 3. Compute HMAC-SHA256 signature
  const computedSignature =
    'v0=' + (await createHmacHexDigest('sha256', signingSecret, baseString))

  // 4. Compare signatures using timing-safe comparison
  if (!timingSafeEqual(signature, computedSignature)) {
    throw new Error('Invalid signature')
  }

  return true
}

/**
 * Extracts and validates required Slack headers from a request.
 *
 * @throws {Error} if required headers are missing or invalid.
 */
export function extractSlackHeaders(req: AnyRequest): SlackHeaders {
  const timestamp = getHeader(req, 'x-slack-request-timestamp')
  const signature = getHeader(req, 'x-slack-signature')

  if (!timestamp) {
    throw new Error('Missing X-Slack-Request-Timestamp header')
  }

  if (!signature) {
    throw new Error('Missing X-Slack-Signature header')
  }

  if (!signature.startsWith('v0=')) {
    throw new Error('Invalid signature format')
  }

  return { timestamp, signature }
}

/**
 * Complete Slack request validation including headers and signature.
 */
export async function validateSlackRequest(
  req: AnyRequest,
  rawBody: string,
  signingSecret: string
): Promise<boolean> {
  const { timestamp, signature } = extractSlackHeaders(req)

  return await validateSlackSignature(
    rawBody,
    timestamp,
    signature,
    signingSecret
  )
}
