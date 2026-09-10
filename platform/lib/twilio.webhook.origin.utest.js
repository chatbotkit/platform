import { getTwilioIntegrationWebhook } from '@/lib/twilio.webhook'

jest.mock('@/config/site', () => ({
  siteUrl: 'https://api.example.com',
  siteHost: 'api.example.com',
  siteHostname: 'api.example.com',
  apiUrl: 'https://api.example.com',
  apiHost: 'api.example.com',
}))

describe('Twilio deployment URLs', () => {
  it('uses /api when the api.* hostname also serves the site', () => {
    expect(getTwilioIntegrationWebhook('demo', 'api.example.com')).toBe(
      'https://api.example.com/api/v1/integration/twilio/demo/webhook#tt=15000&rp=5xx'
    )
  })

  it('uses HTTP and keeps the port on a local deployment', () => {
    expect(getTwilioIntegrationWebhook('demo', 'cbk.localhost:3000')).toBe(
      'http://cbk.localhost:3000/api/v1/integration/twilio/demo/webhook#tt=15000&rp=5xx'
    )
  })
})
