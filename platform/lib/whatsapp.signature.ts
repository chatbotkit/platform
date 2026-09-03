import { type AnyRequest, getHeader } from '@/lib/header'
import { verifyMetaSignature } from '@/lib/meta.signature'

/**
 * Validate Meta's HMAC-SHA256 signature over the exact webhook request body.
 *
 * @note WhatsApp, Messenger and Instagram all sign with the same Meta scheme,
 * so the digest and comparison live in `meta.signature`; this keeps the
 * throwing contract the WhatsApp callback was written against.
 */
export async function validateWhatsAppSignature(
  requestBody: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  if (!appSecret) {
    throw new Error('Missing WhatsApp app secret')
  }

  const verified = await verifyMetaSignature({
    rawBody: requestBody,
    header: signature,
    appSecret,
  })

  if (!verified) {
    throw new Error('Invalid signature')
  }

  return true
}

export function extractWhatsAppSignature(req: AnyRequest): string {
  const signature = getHeader(req, 'x-hub-signature-256')

  if (!signature) {
    throw new Error('Missing X-Hub-Signature-256 header')
  }

  if (!signature.startsWith('sha256=')) {
    throw new Error('Invalid signature format')
  }

  return signature
}

export async function validateWhatsAppRequest(
  req: AnyRequest,
  rawBody: string,
  appSecret: string
): Promise<boolean> {
  return await validateWhatsAppSignature(
    rawBody,
    extractWhatsAppSignature(req),
    appSecret
  )
}
