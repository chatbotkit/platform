import { createHmacHexDigest, timingSafeEqual } from '@/lib/webcrypto'

/**
 * Validates Telegram's `X-Telegram-Bot-Api-Secret-Token`. Not a signature but
 * a shared secret echoed back on every callback, registered with `setWebhook`.
 *
 * @note Telegram sends the header only when the webhook was registered with a
 * secret, so an integration registered before this existed presents no header
 * at all - which the caller treats as unverifiable rather than as hostile.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export function verifyTelegramSecretToken({
  header,
  secretToken,
}: {
  header: string | null | undefined
  secretToken: string
}): boolean {
  if (!header) {
    return false
  }

  return timingSafeEqual(header, secretToken)
}

/**
 * The webhook secret token for one bot, derived rather than stored.
 *
 * @note deriving it from the bot token keeps it out of the schema: the value
 * is reproducible at both registration and verification, rotates when the bot
 * token does, and is never persisted alongside the credential it comes from.
 * Telegram accepts 1-256 characters of `A-Za-z0-9_-`, which a hex digest
 * satisfies.
 */
export async function deriveTelegramSecretToken(
  botToken: string
): Promise<string> {
  return createHmacHexDigest('sha256', botToken, 'telegram-webhook-secret')
}
