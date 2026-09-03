import { getExternalAPIHostURL } from '@/lib/host'

/**
 * Gets the webhook URL for a Telegram integration
 */
export function getTelegramIntegrationWebhook(
  telegramIntegrationId: string
): string {
  return getExternalAPIHostURL(
    `/v1/integration/telegram/${telegramIntegrationId}/webhook`
  )
}
