import Recall from '@/pages/integrations/recall/[recallIntegrationId]/index'
import Twilio from '@/pages/integrations/twilio/[twilioIntegrationId]/index'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/hooks/useHost', () => ({ useAPIHost: () => 'brand.example' }))
jest.mock('@/hooks/useExternalAPIURL', () => ({
  __esModule: true,
  default: () => (path) => `https://brand.example/api${path}`,
}))

function collectProps(element, matches = []) {
  if (Array.isArray(element)) {
    element.forEach((child) => collectProps(child, matches))
  } else if (element?.props) {
    matches.push(element.props)
    collectProps(element.props.children, matches)
  }

  return matches
}

describe('integration installation URLs', () => {
  it.each([
    ['Recall', Recall],
    ['Twilio', Twilio],
  ])('%s uses the runtime URL in both the page and install popup', (_name, Page) => {
    const props = collectProps(Page({ integration: { id: 'demo' } }))
    const popup = props.find((props) => props.installDetails).installDetails
    const endpoint = popup.endpoints?.[0] || popup.sections.Messaging.endpoints[0]

    expect(new URL(endpoint.url).origin).toBe('https://brand.example')
    expect(new URL(endpoint.url).pathname).toMatch(/^\/api\/v1\/integration\//)
    expect(props.some((props) =>
      props.endpoints === popup.endpoints && !!props.endpoints ||
      props.sections === popup.sections && !!props.sections
    )).toBe(true)
  })
})
