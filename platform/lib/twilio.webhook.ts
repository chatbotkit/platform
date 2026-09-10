import { getExternalAPIHostURL } from '@/lib/host'

/**
 * Generates a webhook URL for a Twilio integration
 */
export function getTwilioIntegrationWebhook(
  twilioIntegrationId: string,
  host?: string,
  getAPIURL: (path: string) => string = (path) =>
    getExternalAPIHostURL(path, host)
): string {
  const url = new URL(
    getAPIURL(`/v1/integration/twilio/${twilioIntegrationId}/webhook`)
  )

  url.hash = new URLSearchParams({
    tt: '15000',
    rp: '5xx',
  }).toString()

  return url.href
}
