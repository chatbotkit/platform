/**
 * @jest-environment node
 */
import { getServerSideProps } from './frame'

jest.mock('@/lib/example.fetch', () => ({
  getExampleBySlug: jest.fn(() => ({
    slug: 'concierge',
    title: 'Concierge',
    description: 'A concierge',
    live: true,
    backstory: 'You are a concierge',
    model: 'gpt-4o',
    widget: {},
  })),
}))
jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(async () => null),
}))
jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))
jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(),
}))
jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({ createConversationSessionToken: jest.fn() })
)
jest.mock('@/pages/integrations/widget/[widgetIntegrationId]/frame', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/hooks/useIsTop', () => jest.fn(() => true))

function context(host) {
  const headers = {}

  return {
    params: { slug: 'concierge' },
    query: {},
    req: { method: 'GET', url: '/examples/concierge/frame', query: {}, headers: { host } },
    res: {
      setHeader: jest.fn((name, value) => {
        headers[name] = value
      }),
      headers,
    },
  }
}

describe('examples frame getServerSideProps', () => {
  it('allows the embedding origin with the scheme and port the deployment serves', async () => {
    const ctx = context('cbk.localhost:3000')

    const result = await getServerSideProps(ctx)

    expect(result.props.integration.id).toBe('concierge')
    // @note a hard-coded https would reject the http origin the local
    // stack embeds from
    expect(ctx.res.headers['Content-Security-Policy']).toBe(
      "frame-ancestors 'self' http://cbk.localhost:3000"
    )
  })

  it('keeps https for a public host', async () => {
    const ctx = context('acme.chatbotkit.agency')

    await getServerSideProps(ctx)

    expect(ctx.res.headers['Content-Security-Policy']).toBe(
      "frame-ancestors 'self' https://acme.chatbotkit.agency"
    )
  })
})
