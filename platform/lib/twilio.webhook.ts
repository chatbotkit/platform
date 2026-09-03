/**
 * Generates a webhook URL for a Twilio integration
 */
export function getTwilioIntegrationWebhook(
  twilioIntegrationId: string,
  host?: string
): string {
  const url = new URL(
    `${
      host?.startsWith('api.') ? '' : '/api'
    }/v1/integration/twilio/${twilioIntegrationId}/webhook`,
    `https://${host}`
  )

  url.hash = new URLSearchParams({
    tt: '15000',
    rp: '5xx',
  }).toString()

  return url.href
}
