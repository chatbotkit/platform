import { getInstallDetails } from './index'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://build.example${path}`),
}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/twilio.webhook', () => ({
  getTwilioIntegrationWebhook: jest.fn((id, host, getAPIURL) =>
    getAPIURL(`/v1/${id}`)
  ),
}))
jest.mock('@/hooks/useExternalAPIURL', () => jest.fn())

describe('twilio getInstallDetails', () => {
  it('builds the webhooks with the runtime URL builder the page passes', () => {
    const { sections } = getInstallDetails({
      integration: { id: 'twilio_1' },
      getAPIURL: (path) => `http://cbk.localhost:3000/api${path}`,
    })

    // @note the build-time builder knows nothing of the request host
    expect(sections.Messaging.endpoints[0].url).toBe(
      'http://cbk.localhost:3000/api/v1/twilio_1'
    )
    expect(sections.Calls.endpoints[0].url).toBe(
      'http://cbk.localhost:3000/api/v1/twilio_1'
    )
  })

  it('serves requestless callers from the configured builder', () => {
    const { sections } = getInstallDetails({ integration: { id: 'twilio_1' } })

    expect(sections.Messaging.endpoints[0].url).toBe(
      'https://build.example/v1/twilio_1'
    )
  })
})
